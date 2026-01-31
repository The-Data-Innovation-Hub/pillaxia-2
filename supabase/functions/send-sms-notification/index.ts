import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { validateSchema, validators, validationErrorResponse } from "../_shared/validation.ts";

const FUNCTION_NAME = "send-sms-notification";

const smsRequestSchema = {
  user_id: validators.optional(validators.uuid()),
  phone_number: validators.optional(validators.string({ maxLength: 20 })),
  message: validators.string({ minLength: 1, maxLength: 1600 }),
  notification_type: validators.string({ minLength: 1, maxLength: 100 }),
  metadata: validators.optional(validators.object()),
};

serve(withSentry(FUNCTION_NAME, async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.info(`[${FUNCTION_NAME}] Twilio credentials not configured, SMS disabled`);
    return new Response(
      JSON.stringify({ error: "SMS not configured", skipped: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse and validate input
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const validation = validateSchema(smsRequestSchema, body);
  if (!validation.success) {
    return validationErrorResponse(validation, corsHeaders);
  }

  const { user_id, phone_number, message, notification_type, metadata } = validation.data;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let targetPhone = phone_number;

  // If user_id provided, look up phone from profile
  if (user_id && !phone_number) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("phone")
      .eq("user_id", user_id)
      .single();

    if (profileError) {
      console.error(`[${FUNCTION_NAME}] Error fetching profile:`, profileError);
      captureException(profileError);
    }

    if (!profile?.phone) {
      console.info(`[${FUNCTION_NAME}] No phone number for user ${user_id}`);
      return new Response(
        JSON.stringify({ error: "No phone number on file", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    targetPhone = profile.phone;
  }

  if (!targetPhone) {
    return new Response(
      JSON.stringify({ error: "No phone number provided" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Format phone number (ensure it has country code)
  const formattedPhone = targetPhone.startsWith("+") ? targetPhone : `+1${targetPhone.replace(/\D/g, "")}`;

  // Truncate message to safe length
  const safeMessage = message.substring(0, 1600);

  console.info(`[${FUNCTION_NAME}] Sending SMS to ${formattedPhone}: ${safeMessage.substring(0, 50)}...`);

  // Send via Twilio with status callback
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  
  // Build status callback URL
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;

  const twilioBody = new URLSearchParams({
    To: formattedPhone,
    From: TWILIO_PHONE_NUMBER,
    Body: safeMessage,
    StatusCallback: statusCallbackUrl,
  });

  try {
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: twilioBody,
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error(`[${FUNCTION_NAME}] Twilio error:`, twilioResult);
      
      // Log failed notification
      if (user_id) {
        await supabase.from("notification_history").insert({
          user_id,
          channel: "sms",
          notification_type,
          title: notification_type,
          body: safeMessage.substring(0, 200),
          status: "failed",
          error_message: (twilioResult.message || "Twilio API error").slice(0, 500),
          metadata: { ...metadata, phone: formattedPhone },
        });
      }

      return new Response(
        JSON.stringify({ error: twilioResult.message || "SMS failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.info(`[${FUNCTION_NAME}] SMS sent successfully:`, twilioResult.sid);

    // Log successful notification
    if (user_id) {
      await supabase.from("notification_history").insert({
        user_id,
        channel: "sms",
        notification_type,
        title: notification_type,
        body: safeMessage.substring(0, 200),
        status: "sent",
        metadata: { ...metadata, phone: formattedPhone, twilio_sid: twilioResult.sid },
      });
    }

    return new Response(
      JSON.stringify({ success: true, sid: twilioResult.sid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Error sending SMS:`, error);
    if (error instanceof Error) captureException(error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
