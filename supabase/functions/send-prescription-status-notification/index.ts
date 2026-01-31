import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { validators, validateSchema, validationErrorResponse } from "../_shared/validation.ts";

// Input validation schema
const statusNotificationSchema = {
  patient_user_id: validators.uuid(),
  medication_name: validators.string({ minLength: 1, maxLength: 200 }),
  new_status: validators.string({ minLength: 1, maxLength: 50 }),
  pharmacy: validators.optional(validators.string({ maxLength: 200 })),
};

// XSS prevention utility
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

const STATUS_MESSAGES: Record<string, { title: string; body: string; emoji: string }> = {
  pending: {
    title: "Prescription Received",
    body: "Your prescription for {medication} has been received and is being processed.",
    emoji: "📋",
  },
  sent: {
    title: "Prescription Sent to Pharmacy",
    body: "Your prescription for {medication} has been sent to {pharmacy}.",
    emoji: "📤",
  },
  ready: {
    title: "Prescription Ready for Pickup!",
    body: "Great news! Your {medication} is ready for pickup at {pharmacy}.",
    emoji: "✅",
  },
  picked_up: {
    title: "Prescription Picked Up",
    body: "Your {medication} has been marked as picked up. Stay healthy!",
    emoji: "🎉",
  },
  completed: {
    title: "Prescription Completed",
    body: "Your prescription for {medication} has been completed.",
    emoji: "✔️",
  },
  cancelled: {
    title: "Prescription Cancelled",
    body: "Your prescription for {medication} has been cancelled. Contact your pharmacy for details.",
    emoji: "❌",
  },
};

serve(withSentry("send-prescription-status-notification", async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const validation = validateSchema(statusNotificationSchema, body);
    
    if (!validation.success) {
      return validationErrorResponse(validation, corsHeaders);
    }

    const { patient_user_id, medication_name, new_status, pharmacy } = validation.data;

    console.info(`Sending prescription status notification: ${new_status} for ${medication_name} to user ${patient_user_id}`);

    // Get patient profile and notification preferences
    const [profileResult, prefsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("user_id", patient_user_id)
        .maybeSingle(),
      supabase
        .from("patient_notification_preferences")
        .select("email_reminders, push_clinician_messages")
        .eq("user_id", patient_user_id)
        .maybeSingle(),
    ]);

    const profile = profileResult.data;
    const prefs = prefsResult.data;

    if (!profile) {
      console.info("Patient profile not found");
      return new Response(
        JSON.stringify({ success: false, error: "Patient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusConfig = STATUS_MESSAGES[new_status] || STATUS_MESSAGES.pending;
    const pharmacyName = pharmacy || "your pharmacy";
    
    // Escape dynamic content for XSS prevention
    const safeMedicationName = escapeHtml(medication_name);
    const safePharmacyName = escapeHtml(pharmacyName);
    const safePatientName = escapeHtml(profile.first_name || "there");
    
    const title = `${statusConfig.emoji} ${statusConfig.title}`;
    const bodyText = statusConfig.body
      .replace("{medication}", safeMedicationName)
      .replace("{pharmacy}", safePharmacyName);

    const results = {
      email: { sent: false, error: null as string | null },
      push: { sent: false, error: null as string | null },
    };

    // Send email notification
    const emailEnabled = prefs?.email_reminders !== false; // Default to true if no prefs
    if (emailEnabled && profile.email && resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        
        const { error: emailError } = await resend.emails.send({
          from: "Pillaxia <notifications@pillaxia.com>",
          to: [profile.email],
          subject: statusConfig.title,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
              <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                <div style="text-align: center; margin-bottom: 24px;">
                  <span style="font-size: 48px;">${statusConfig.emoji}</span>
                </div>
                <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 16px; text-align: center;">
                  ${escapeHtml(statusConfig.title)}
                </h1>
                <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                  Hi ${safePatientName},
                </p>
                <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                  ${bodyText}
                </p>
                ${new_status === "ready" ? `
                <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
                  <p style="color: #047857; margin: 0; font-weight: 600;">
                    📍 Ready at: ${safePharmacyName}
                  </p>
                </div>
                ` : ""}
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
                <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
                  This notification was sent by Pillaxia. You can manage your notification preferences in the app settings.
                </p>
              </div>
            </body>
            </html>
          `,
        });

        if (emailError) {
          console.error("Email send error:", emailError);
          results.email.error = emailError.message;
        } else {
          results.email.sent = true;
          console.info("Email sent successfully");
        }

        // Log to notification history
        await supabase.from("notification_history").insert({
          user_id: patient_user_id,
          channel: "email",
          notification_type: "prescription_status",
          title: statusConfig.title,
          body: bodyText,
          status: results.email.sent ? "sent" : "failed",
          error_message: results.email.error,
          metadata: { status: new_status, medication: medication_name },
        });
      } catch (err) {
        console.error("Email notification error:", err);
        captureException(err instanceof Error ? err : new Error(String(err)));
        results.email.error = err instanceof Error ? err.message : "Unknown error";
      }
    }

    // Send push notification
    const pushEnabled = prefs?.push_clinician_messages !== false; // Default to true
    if (pushEnabled) {
      try {
        const { data: pushResult, error: pushError } = await supabase.functions.invoke(
          "send-push-notification",
          {
            body: {
              user_ids: [patient_user_id],
              payload: {
                title: title,
                body: bodyText,
                tag: "prescription_status",
                data: { status: new_status, medication: medication_name },
                requireInteraction: new_status === "ready",
              },
            },
          }
        );

        if (pushError) {
          console.error("Push notification error:", pushError);
          results.push.error = pushError.message;
        } else if (pushResult?.sent > 0) {
          results.push.sent = true;
          console.info("Push notification sent");
        }
      } catch (err) {
        console.error("Push notification error:", err);
        captureException(err instanceof Error ? err : new Error(String(err)));
        results.push.error = err instanceof Error ? err.message : "Unknown error";
      }
    }

    console.info("Notification results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Notifications sent for status: ${new_status}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-prescription-status-notification:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
