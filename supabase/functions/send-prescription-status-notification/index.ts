import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface StatusNotificationRequest {
  patient_user_id: string;
  medication_name: string;
  new_status: string;
  pharmacy?: string;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { patient_user_id, medication_name, new_status, pharmacy }: StatusNotificationRequest = await req.json();

    if (!patient_user_id || !medication_name || !new_status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending prescription status notification: ${new_status} for ${medication_name} to user ${patient_user_id}`);

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
      console.log("Patient profile not found");
      return new Response(
        JSON.stringify({ success: false, error: "Patient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const statusConfig = STATUS_MESSAGES[new_status] || STATUS_MESSAGES.pending;
    const pharmacyName = pharmacy || "your pharmacy";
    
    const title = `${statusConfig.emoji} ${statusConfig.title}`;
    const body = statusConfig.body
      .replace("{medication}", medication_name)
      .replace("{pharmacy}", pharmacyName);

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
                  ${statusConfig.title}
                </h1>
                <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                  Hi ${profile.first_name || "there"},
                </p>
                <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px; text-align: center;">
                  ${body}
                </p>
                ${new_status === "ready" ? `
                <div style="background: #ecfdf5; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
                  <p style="color: #047857; margin: 0; font-weight: 600;">
                    📍 Ready at: ${pharmacyName}
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
          console.log("Email sent successfully");
        }

        // Log to notification history
        await supabase.from("notification_history").insert({
          user_id: patient_user_id,
          channel: "email",
          notification_type: "prescription_status",
          title: statusConfig.title,
          body: body,
          status: results.email.sent ? "sent" : "failed",
          error_message: results.email.error,
          metadata: { status: new_status, medication: medication_name },
        });
      } catch (err) {
        console.error("Email notification error:", err);
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
                body: body,
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
          console.log("Push notification sent");
        }
      } catch (err) {
        console.error("Push notification error:", err);
        results.push.error = err instanceof Error ? err.message : "Unknown error";
      }
    }

    console.log("Notification results:", results);

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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
