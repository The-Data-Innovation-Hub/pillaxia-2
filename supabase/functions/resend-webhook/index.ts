import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as encodeBase64, decode as decodeBase64 } from "https://deno.land/std@0.190.0/encoding/base64.ts";

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

// Verify webhook signature using Svix HMAC
async function verifyWebhookSignature(
  payload: string,
  headers: Headers,
  secret: string
): Promise<boolean> {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("Missing Svix headers");
    return false;
  }

  // Check timestamp to prevent replay attacks (5 minute tolerance)
  const timestampSeconds = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSeconds) > 300) {
    console.error("Webhook timestamp too old or in future");
    return false;
  }

  // Extract the secret key (remove "whsec_" prefix if present)
  const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const secretBytes = decodeBase64(secretKey);

  // Create the signed content
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const encoder = new TextEncoder();

  // Import key and generate HMAC
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedContent)
  );

  const expectedSignature = encodeBase64(signatureBytes);

  // Parse the signatures from header (format: "v1,signature1 v1,signature2")
  const signatures = svixSignature.split(" ");
  
  for (const sig of signatures) {
    const [version, signature] = sig.split(",");
    if (version === "v1" && signature === expectedSignature) {
      return true;
    }
  }

  console.error("No matching signature found");
  return false;
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

    // Get Resend webhook signing secret for verification
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    
    // Read the raw body for signature verification
    const payload = await req.text();
    
    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const isValid = await verifyWebhookSignature(payload, req.headers, webhookSecret);
      
      if (!isValid) {
        console.error("Invalid webhook signature");
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log("Webhook signature verified successfully");
    } else {
      console.warn("RESEND_WEBHOOK_SECRET not configured - skipping signature verification");
    }

    const event: ResendWebhookEvent = JSON.parse(payload);
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
