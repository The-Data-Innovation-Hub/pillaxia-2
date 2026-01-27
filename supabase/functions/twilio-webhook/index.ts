import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Twilio SMS/WhatsApp Status Callback Webhook
 * 
 * Receives delivery status updates from Twilio for SMS and WhatsApp messages.
 * Updates notification_history with delivery tracking timestamps.
 * 
 * Twilio status values:
 * - queued: Message is queued to be sent
 * - sending: Message is being sent
 * - sent: Message has been sent to carrier
 * - delivered: Carrier confirmed delivery
 * - undelivered: Carrier could not deliver
 * - failed: Message failed to send
 * - read: (WhatsApp only) Message was read
 */

interface TwilioStatusCallback {
  MessageSid: string;
  MessageStatus: string;
  To: string;
  From: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  AccountSid: string;
  ApiVersion: string;
  SmsSid?: string;
  SmsStatus?: string;
}

// Map Twilio status to our internal status
function mapTwilioStatus(twilioStatus: string): string {
  const statusMap: Record<string, string> = {
    queued: "pending",
    sending: "pending",
    sent: "sent",
    delivered: "delivered",
    undelivered: "failed",
    failed: "failed",
    read: "read",
  };
  return statusMap[twilioStatus] || twilioStatus;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Twilio sends form-urlencoded data
    const formData = await req.formData();
    const callback: TwilioStatusCallback = {
      MessageSid: formData.get("MessageSid") as string,
      MessageStatus: formData.get("MessageStatus") as string,
      To: formData.get("To") as string,
      From: formData.get("From") as string,
      ErrorCode: formData.get("ErrorCode") as string | undefined,
      ErrorMessage: formData.get("ErrorMessage") as string | undefined,
      AccountSid: formData.get("AccountSid") as string,
      ApiVersion: formData.get("ApiVersion") as string,
      SmsSid: formData.get("SmsSid") as string | undefined,
      SmsStatus: formData.get("SmsStatus") as string | undefined,
    };

    console.log("Received Twilio status callback:", JSON.stringify(callback));

    if (!callback.MessageSid || !callback.MessageStatus) {
      console.error("Missing required fields in callback");
      return new Response("Missing required fields", { status: 400 });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine channel type from the To field
    const isWhatsApp = callback.To.startsWith("whatsapp:");
    const channel = isWhatsApp ? "whatsapp" : "sms";

    // Find notification by Twilio SID in metadata
    const { data: notifications, error: fetchError } = await supabase
      .from("notification_history")
      .select("id, status, metadata")
      .eq("channel", channel)
      .filter("metadata->twilio_sid", "eq", callback.MessageSid);

    if (fetchError) {
      console.error("Error fetching notifications:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!notifications || notifications.length === 0) {
      // Try alternate metadata key for WhatsApp
      const { data: altNotifications, error: altError } = await supabase
        .from("notification_history")
        .select("id, status, metadata")
        .eq("channel", channel)
        .filter("metadata->message_id", "eq", callback.MessageSid);

      if (altError || !altNotifications || altNotifications.length === 0) {
        console.log(`No notification found for MessageSid: ${callback.MessageSid}`);
        // Return 200 to acknowledge receipt (Twilio will retry on non-200)
        return new Response(JSON.stringify({ message: "No matching notification found" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Process alternate notifications
      for (const notification of altNotifications) {
        await processNotificationUpdate(supabase, notification.id, notification.metadata, callback);
      }
    } else {
      // Process found notifications
      for (const notification of notifications) {
        await processNotificationUpdate(supabase, notification.id, notification.metadata, callback);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in twilio-webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processNotificationUpdate(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  notificationId: string,
  currentMetadata: Record<string, unknown> | null,
  callback: TwilioStatusCallback
) {
  const newStatus = mapTwilioStatus(callback.MessageStatus);
  const metadata = currentMetadata || {};
  
  // Build event history
  const eventHistory = (metadata.delivery_events as string[]) || [];
  eventHistory.push(`${callback.MessageStatus} at ${new Date().toISOString()}`);

  const updatedMetadata = {
    ...metadata,
    delivery_events: eventHistory,
    last_event: callback.MessageStatus,
    last_event_at: new Date().toISOString(),
    twilio_error_code: callback.ErrorCode || null,
    twilio_error_message: callback.ErrorMessage || null,
  };

  // Build update object
  // deno-lint-ignore no-explicit-any
  const updateData: any = {
    status: newStatus,
    metadata: updatedMetadata,
  };

  // Set timestamps based on status
  if (callback.MessageStatus === "delivered") {
    updateData.delivered_at = new Date().toISOString();
  } else if (callback.MessageStatus === "read") {
    // WhatsApp read receipts
    updateData.opened_at = new Date().toISOString();
  } else if (callback.MessageStatus === "failed" || callback.MessageStatus === "undelivered") {
    updateData.error_message = callback.ErrorMessage || `Twilio error: ${callback.ErrorCode}`;
  }

  const { error: updateError } = await supabase
    .from("notification_history")
    .update(updateData)
    .eq("id", notificationId);

  if (updateError) {
    console.error(`Error updating notification ${notificationId}:`, updateError);
  } else {
    console.log(`Updated notification ${notificationId} to status: ${newStatus}`);
  }
}
