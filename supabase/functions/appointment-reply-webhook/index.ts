import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry, captureMessage } from "../_shared/sentry.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const FUNCTION_NAME = "appointment-reply-webhook";

/**
 * Twilio Incoming Message Webhook for Appointment Replies
 * 
 * Handles patient replies to appointment reminder messages.
 * Supported commands:
 * - CONFIRM / YES / 1 - Confirm the appointment
 * - RESCHEDULE / CHANGE / 2 - Request to reschedule
 * - CANCEL / NO / 3 - Cancel the appointment
 * - HELP - Get available commands
 */

interface TwilioIncomingMessage {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
}

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.info(`[${FUNCTION_NAME}] ${step}${detailsStr}`);
};

// Validate Twilio request signature (HMAC-SHA1)
async function validateTwilioSignature(
  req: Request,
  body: string
): Promise<{ valid: boolean; reason?: string }> {
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  
  // SECURITY: Require auth token in production
  if (!twilioAuthToken) {
    const isProduction = Deno.env.get("ENVIRONMENT") === "production";
    if (isProduction) {
      return { valid: false, reason: "TWILIO_AUTH_TOKEN required in production" };
    }
    logStep("WARNING: Signature verification disabled (development)");
    return { valid: true };
  }

  const signature = req.headers.get("X-Twilio-Signature");
  if (!signature) {
    return { valid: false, reason: "Missing X-Twilio-Signature header" };
  }

  // Build the URL that Twilio signed (must match exactly)
  const url = req.url;
  
  // Sort form parameters and create signature base
  const params = new URLSearchParams(body);
  const sortedParams = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const paramString = sortedParams.map(([k, v]) => `${k}${v}`).join("");
  const signatureBase = url + paramString;

  // Generate HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(twilioAuthToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signatureBase));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

  if (signature !== expectedSignature) {
    return { valid: false, reason: "Signature mismatch" };
  }

  return { valid: true };
}

// Validate incoming message fields
function validateIncomingMessage(formData: FormData): {
  valid: boolean;
  message?: TwilioIncomingMessage;
  error?: string;
} {
  const messageSid = formData.get("MessageSid") as string;
  const from = formData.get("From") as string;
  const body = formData.get("Body") as string;
  const accountSid = formData.get("AccountSid") as string;

  if (!messageSid || typeof messageSid !== "string" || messageSid.length < 10) {
    return { valid: false, error: "Invalid or missing MessageSid" };
  }
  if (!from || typeof from !== "string") {
    return { valid: false, error: "Invalid or missing From field" };
  }
  if (!body || typeof body !== "string") {
    return { valid: false, error: "Invalid or missing Body field" };
  }
  if (!accountSid || typeof accountSid !== "string") {
    return { valid: false, error: "Invalid or missing AccountSid" };
  }

  // Sanitize body - limit length and remove potential injection
  const sanitizedBody = body.trim().substring(0, 160);

  return {
    valid: true,
    message: {
      MessageSid: messageSid,
      AccountSid: accountSid,
      From: from,
      To: formData.get("To") as string || "",
      Body: sanitizedBody,
    },
  };
}

// Parse command from message body
function parseCommand(body: string): "confirm" | "reschedule" | "cancel" | "help" | "unknown" {
  const normalizedBody = body.trim().toUpperCase();
  
  if (["CONFIRM", "YES", "Y", "1", "OK", "CONFIRMED"].includes(normalizedBody)) {
    return "confirm";
  }
  if (["RESCHEDULE", "CHANGE", "2", "MOVE", "POSTPONE"].includes(normalizedBody)) {
    return "reschedule";
  }
  if (["CANCEL", "NO", "N", "3", "CANCELLED"].includes(normalizedBody)) {
    return "cancel";
  }
  if (["HELP", "?", "COMMANDS", "OPTIONS"].includes(normalizedBody)) {
    return "help";
  }
  return "unknown";
}

// Send SMS/WhatsApp reply via Twilio
async function sendReply(
  to: string,
  message: string,
  isWhatsApp: boolean
): Promise<{ success: boolean; error?: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !twilioPhone) {
    return { success: false, error: "Twilio not configured" };
  }

  try {
    const fromNumber = isWhatsApp ? `whatsapp:${twilioPhone}` : twilioPhone;
    const toNumber = to; // Already formatted from Twilio

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: toNumber,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || "Twilio API error" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

serve(withSentry(FUNCTION_NAME, async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    
    // Verify Twilio signature
    const signatureResult = await validateTwilioSignature(req, rawBody);
    if (!signatureResult.valid) {
      logStep("Signature validation failed", { reason: signatureResult.reason });
      await captureMessage(`Twilio signature validation failed: ${signatureResult.reason}`, "warning", {
        functionName: FUNCTION_NAME,
      });
      return new Response(
        JSON.stringify({ error: signatureResult.reason }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse form data
    const formData = new URLSearchParams(rawBody);
    const formDataObj = new FormData();
    for (const [key, value] of formData.entries()) {
      formDataObj.append(key, value);
    }

    // Validate incoming message
    const validation = validateIncomingMessage(formDataObj);
    if (!validation.valid || !validation.message) {
      logStep("Validation failed", { error: validation.error });
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const incoming = validation.message;
    const isWhatsApp = incoming.From.startsWith("whatsapp:");
    
    logStep("Received incoming message", {
      from: incoming.From,
      body: incoming.Body.substring(0, 50),
      isWhatsApp,
    });

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract phone number (remove country code formatting)
    const phoneNumber = incoming.From.replace("whatsapp:", "").replace(/\D/g, "");

    // Parse the command
    const command = parseCommand(incoming.Body);

    // Find patient by phone number
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, first_name, phone")
      .or(`phone.ilike.%${phoneNumber},phone.ilike.%${phoneNumber.slice(-10)}`)
      .maybeSingle();

    if (profileError) {
      logStep("Error finding profile", { error: profileError.message });
    }

    if (!profile) {
      logStep(`No patient found for phone: ${phoneNumber}`);
      const helpMessage = `We couldn't find your account. Please ensure you're using the phone number registered with Pillaxia. For assistance, contact support@pillaxia.com`;
      await sendReply(incoming.From, helpMessage, isWhatsApp);
      
      return new Response(
        JSON.stringify({ success: true, message: "No matching patient" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle HELP command
    if (command === "help") {
      const helpMessage = `Pillaxia Appointment Commands:\n\n• Reply CONFIRM or YES to confirm\n• Reply RESCHEDULE or CHANGE to request a new time\n• Reply CANCEL or NO to cancel\n\nFor other inquiries, contact support@pillaxia.com`;
      await sendReply(incoming.From, helpMessage, isWhatsApp);
      
      return new Response(
        JSON.stringify({ success: true, command: "help" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the patient's upcoming appointment (next scheduled or confirmed)
    const today = new Date().toISOString().split("T")[0];
    const { data: appointment, error: apptError } = await supabase
      .from("appointments")
      .select("*")
      .eq("patient_user_id", profile.user_id)
      .gte("appointment_date", today)
      .in("status", ["scheduled", "confirmed"])
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (apptError) {
      logStep("Error finding appointment", { error: apptError.message });
    }

    if (!appointment) {
      const firstName = profile.first_name || "there";
      const noApptMessage = `Hi ${firstName}, we couldn't find any upcoming appointments for you. If you believe this is an error, please contact us at support@pillaxia.com`;
      await sendReply(incoming.From, noApptMessage, isWhatsApp);
      
      return new Response(
        JSON.stringify({ success: true, message: "No upcoming appointment" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format appointment details
    const apptDate = new Date(appointment.appointment_date).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const apptTime = appointment.appointment_time.slice(0, 5);
    const firstName = profile.first_name || "there";

    let responseMessage = "";
    let newStatus = appointment.status;

    switch (command) {
      case "confirm":
        newStatus = "confirmed";
        responseMessage = `✅ Your appointment "${appointment.title}" on ${apptDate} at ${apptTime} has been confirmed. Thank you!`;
        break;

      case "reschedule":
        newStatus = "reschedule_requested";
        responseMessage = `📅 We've received your request to reschedule "${appointment.title}" on ${apptDate}. Our team will contact you shortly with available times. You can also log in to Pillaxia to choose a new time.`;
        break;

      case "cancel":
        newStatus = "cancelled";
        responseMessage = `❌ Your appointment "${appointment.title}" on ${apptDate} at ${apptTime} has been cancelled. To book a new appointment, please log in to Pillaxia or contact your care team.`;
        break;

      case "unknown":
      default:
        responseMessage = `Hi ${firstName}, I didn't understand that. For your appointment on ${apptDate}:\n\n• Reply CONFIRM to confirm\n• Reply RESCHEDULE to request a new time\n• Reply CANCEL to cancel\n• Reply HELP for more options`;
        break;
    }

    // Update appointment status if changed
    if (command !== "unknown" && newStatus !== appointment.status) {
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment.id);

      if (updateError) {
        logStep("Error updating appointment", { error: updateError.message });
        responseMessage = `We're sorry, there was an issue processing your request. Please try again or contact support@pillaxia.com`;
      } else {
        logStep(`Updated appointment ${appointment.id} to status: ${newStatus}`);

        // Log the action to audit_log
        await supabase.from("audit_log").insert({
          user_id: profile.user_id,
          action: `appointment_${command}_via_${isWhatsApp ? "whatsapp" : "sms"}`,
          target_table: "appointments",
          target_id: appointment.id,
          details: {
            previous_status: appointment.status,
            new_status: newStatus,
            message_body: incoming.Body,
            channel: isWhatsApp ? "whatsapp" : "sms",
          },
        });

        // Log to notification history
        await supabase.from("notification_history").insert({
          user_id: profile.user_id,
          channel: isWhatsApp ? "whatsapp" : "sms",
          notification_type: "appointment_reply",
          title: `Appointment ${command}`,
          body: incoming.Body,
          status: "received",
          metadata: {
            appointment_id: appointment.id,
            command,
            message_sid: incoming.MessageSid,
            direction: "inbound",
          },
        });
      }
    }

    // Send the response
    const replyResult = await sendReply(incoming.From, responseMessage, isWhatsApp);
    
    if (!replyResult.success) {
      logStep("Failed to send reply", { error: replyResult.error });
    } else {
      logStep("Reply sent successfully");

      // Log outbound reply
      await supabase.from("notification_history").insert({
        user_id: profile.user_id,
        channel: isWhatsApp ? "whatsapp" : "sms",
        notification_type: "appointment_reply_response",
        title: `Reply to ${command}`,
        body: responseMessage.substring(0, 200),
        status: "sent",
        metadata: {
          appointment_id: appointment.id,
          direction: "outbound",
          in_response_to: incoming.MessageSid,
        },
      });
    }

    // Return TwiML response (empty to prevent duplicate messages)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/xml" 
        } 
      }
    );
  } catch (error: unknown) {
    logStep("ERROR", { message: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
