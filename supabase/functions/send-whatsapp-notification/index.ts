import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  recipientId: string;
  senderName: string;
  message: string;
  notificationType?: "encouragement" | "clinician_message" | "medication_reminder";
}

// Send WhatsApp via Twilio
async function sendViaTwilio(
  phoneNumber: string, 
  messageBody: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !twilioPhone) {
    return { success: false, error: "twilio_not_configured" };
  }

  try {
    // Format Twilio WhatsApp numbers
    const fromWhatsApp = `whatsapp:${twilioPhone}`;
    const toWhatsApp = `whatsapp:${phoneNumber}`;

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromWhatsApp,
          To: toWhatsApp,
          Body: messageBody,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Twilio WhatsApp error:", errorData);
      return { success: false, error: errorData.message || "twilio_api_error" };
    }

    const result = await response.json();
    console.log("Twilio WhatsApp sent successfully:", result.sid);
    return { success: true, messageId: result.sid };
  } catch (error) {
    console.error("Twilio exception:", error);
    return { success: false, error: String(error) };
  }
}

// Send WhatsApp via Meta Graph API (fallback)
async function sendViaMeta(
  phoneNumber: string, 
  messageBody: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const whatsappToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!whatsappToken || !whatsappPhoneId) {
    return { success: false, error: "meta_not_configured" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phoneNumber,
          type: "text",
          text: { body: messageBody },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Meta WhatsApp API error:", errorData);
      return { success: false, error: JSON.stringify(errorData) };
    }

    const result = await response.json();
    console.log("Meta WhatsApp sent successfully:", result);
    return { success: true, messageId: result.messages?.[0]?.id };
  } catch (error) {
    console.error("Meta exception:", error);
    return { success: false, error: String(error) };
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientId, senderName, message, notificationType = "encouragement" }: NotificationRequest = await req.json();

    if (!recipientId || !senderName || !message) {
      throw new Error("Missing required fields");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check patient notification preferences for WhatsApp
    if (notificationType === "clinician_message") {
      const { data: prefData, error: prefError } = await supabase
        .from("patient_notification_preferences")
        .select("whatsapp_clinician_messages")
        .eq("user_id", recipientId)
        .maybeSingle();

      if (prefError) {
        console.error("Error checking patient preferences:", prefError);
      }

      if (prefData && prefData.whatsapp_clinician_messages === false) {
        console.log("Patient has disabled WhatsApp notifications for clinician messages, skipping...");
        return new Response(
          JSON.stringify({ 
            success: false, 
            reason: "user_disabled",
            message: "Patient has disabled WhatsApp notifications for clinician messages" 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else if (notificationType === "medication_reminder") {
      const { data: prefData, error: prefError } = await supabase
        .from("patient_notification_preferences")
        .select("whatsapp_reminders")
        .eq("user_id", recipientId)
        .maybeSingle();

      if (prefError) {
        console.error("Error checking patient preferences:", prefError);
      }

      if (prefData && prefData.whatsapp_reminders === false) {
        console.log("Patient has disabled WhatsApp reminders, skipping...");
        return new Response(
          JSON.stringify({ 
            success: false, 
            reason: "user_disabled",
            message: "Patient has disabled WhatsApp reminders" 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      // Check if encouragement messages are enabled (global admin setting)
      const { data: settingData, error: settingError } = await supabase
        .from("notification_settings")
        .select("is_enabled")
        .eq("setting_key", "encouragement_messages")
        .maybeSingle();

      if (settingError) {
        console.error("Error checking notification settings:", settingError);
      }

      if (settingData && !settingData.is_enabled) {
        console.log("Encouragement messages are disabled, skipping WhatsApp notification...");
        return new Response(
          JSON.stringify({ 
            success: false, 
            reason: "disabled",
            message: "Encouragement messages are disabled in settings" 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Get recipient profile to check for phone number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone, first_name")
      .eq("user_id", recipientId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      throw profileError;
    }

    if (!profile?.phone) {
      console.log("No phone number configured for recipient, skipping WhatsApp notification");
      return new Response(
        JSON.stringify({ 
          success: false, 
          reason: "no_phone",
          message: "Recipient has no phone number configured" 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format phone number (remove any non-digits, ensure + prefix)
    let phoneNumber = profile.phone.replace(/\D/g, "");
    if (!phoneNumber.startsWith("+")) {
      phoneNumber = `+${phoneNumber}`;
    }

    // Build message body
    let messageBody: string;
    if (notificationType === "medication_reminder") {
      messageBody = `💊 Pillaxia Reminder\n\n${message}\n\nOpen the app to mark as taken.`;
    } else {
      messageBody = `💬 New message from ${senderName} on Pillaxia:\n\n"${message.substring(0, 500)}"\n\nOpen the app to reply.`;
    }

    // Try Twilio first (primary), then Meta (fallback)
    console.log("Attempting WhatsApp via Twilio...");
    let result = await sendViaTwilio(phoneNumber, messageBody);
    let provider = "twilio";

    if (!result.success && result.error === "twilio_not_configured") {
      console.log("Twilio not configured, trying Meta Graph API...");
      result = await sendViaMeta(phoneNumber.replace("+", ""), messageBody);
      provider = "meta";
    }

    // Log notification result
    const notifType = notificationType === "clinician_message" 
      ? "clinician_message" 
      : notificationType === "medication_reminder"
        ? "medication_reminder"
        : "encouragement_message";

    if (result.success) {
      await supabase.from("notification_history").insert({
        user_id: recipientId,
        channel: "whatsapp",
        notification_type: notifType,
        title: notificationType === "medication_reminder" 
          ? "Medication Reminder" 
          : `Message from ${senderName}`,
        body: message.substring(0, 200),
        status: "sent",
        metadata: { 
          sender_name: senderName, 
          message_id: result.messageId,
          provider 
        },
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "WhatsApp notification sent",
          messageId: result.messageId,
          provider
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      // Both providers failed
      await supabase.from("notification_history").insert({
        user_id: recipientId,
        channel: "whatsapp",
        notification_type: notifType,
        title: notificationType === "medication_reminder" 
          ? "Medication Reminder" 
          : `Message from ${senderName}`,
        body: message.substring(0, 200),
        status: "failed",
        error_message: result.error?.slice(0, 500),
        metadata: { sender_name: senderName, provider },
      });

      // If neither is configured, return gracefully
      if (result.error === "meta_not_configured" || result.error === "twilio_not_configured") {
        console.log("WhatsApp not configured (neither Twilio nor Meta), skipping...");
        return new Response(
          JSON.stringify({ 
            success: false, 
            reason: "not_configured",
            message: "WhatsApp API credentials not configured" 
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      throw new Error(`WhatsApp API error: ${result.error}`);
    }
  } catch (error: unknown) {
    console.error("Error in send-whatsapp-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
