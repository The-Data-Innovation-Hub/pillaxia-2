import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Resend webhook event types we care about
type ResendEventType = 
  | "email.sent"
  | "email.delivered" 
  | "email.delivery_delayed"
  | "email.complained"
  | "email.bounced"
  | "email.opened"
  | "email.clicked";

interface ResendWebhookEvent {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // Bounce-specific fields
    bounce?: {
      message: string;
    };
    // Complaint-specific fields  
    complaint?: {
      feedback_type: string;
    };
  };
}

// Map Resend events to our notification status
function mapEventToStatus(eventType: ResendEventType): string {
  switch (eventType) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.delivery_delayed":
      return "pending";
    case "email.bounced":
    case "email.complained":
      return "failed";
    case "email.opened":
    case "email.clicked":
      return "delivered"; // Keep as delivered, these are engagement events
    default:
      return "sent";
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Resend webhook signing secret for verification (optional but recommended)
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    
    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const svixId = req.headers.get("svix-id");
      const svixTimestamp = req.headers.get("svix-timestamp");
      const svixSignature = req.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error("Missing Svix headers");
        return new Response(
          JSON.stringify({ error: "Missing webhook signature headers" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Note: Full signature verification would require the Svix library
      // For now, we verify presence of headers as a basic check
      console.log("Webhook headers present:", { svixId, svixTimestamp });
    }

    const event: ResendWebhookEvent = await req.json();
    console.log("Received Resend webhook:", event.type, event.data.email_id);

    const newStatus = mapEventToStatus(event.type);
    
    // Build error message for failed events
    let errorMessage: string | null = null;
    if (event.type === "email.bounced" && event.data.bounce) {
      errorMessage = `Bounced: ${event.data.bounce.message}`;
    } else if (event.type === "email.complained" && event.data.complaint) {
      errorMessage = `Complaint: ${event.data.complaint.feedback_type}`;
    }

    // Find and update notification by matching email_id in metadata
    // First, try to find notifications with this email_id
    const { data: notifications, error: findError } = await supabase
      .from("notification_history")
      .select("id, metadata, status")
      .eq("channel", "email")
      .filter("metadata->resend_email_id", "eq", event.data.email_id);

    if (findError) {
      console.error("Error finding notification:", findError);
      // Don't fail the webhook, Resend will retry
      return new Response(
        JSON.stringify({ received: true, updated: false, reason: "find_error" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!notifications || notifications.length === 0) {
      console.log("No notification found for email_id:", event.data.email_id);
      // This is fine - maybe the email wasn't sent through our system
      return new Response(
        JSON.stringify({ received: true, updated: false, reason: "not_found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update each matching notification
    for (const notification of notifications) {
      const currentMetadata = (notification.metadata as Record<string, unknown>) || {};
      
      // Build updated metadata with event history
      const eventHistory = (currentMetadata.delivery_events as string[]) || [];
      eventHistory.push(`${event.type} at ${event.created_at}`);

      const updatedMetadata = {
        ...currentMetadata,
        delivery_events: eventHistory,
        last_event: event.type,
        last_event_at: event.created_at,
      };

      const { error: updateError } = await supabase
        .from("notification_history")
        .update({
          status: newStatus,
          error_message: errorMessage,
          metadata: updatedMetadata,
        })
        .eq("id", notification.id);

      if (updateError) {
        console.error("Error updating notification:", updateError);
      } else {
        console.log(`Updated notification ${notification.id} to status: ${newStatus}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        received: true, 
        updated: true, 
        count: notifications.length,
        new_status: newStatus 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing Resend webhook:", error);
    
    // Return 200 to prevent Resend from retrying on our errors
    return new Response(
      JSON.stringify({ received: true, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
