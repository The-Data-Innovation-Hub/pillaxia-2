import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MissedDosePayload {
  patientUserId: string;
  medicationName: string;
  scheduledTime: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if missed_dose_alerts are enabled
    const { data: setting, error: settingError } = await supabase
      .from("notification_settings")
      .select("is_enabled")
      .eq("setting_key", "missed_dose_alerts")
      .maybeSingle();

    if (settingError) {
      console.error("Error checking notification settings:", settingError);
    }

    // If setting exists and is disabled, skip sending
    if (setting && !setting.is_enabled) {
      console.log("Missed dose alerts are disabled, skipping notification");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "notifications_disabled" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const payload: MissedDosePayload = await req.json();
    const { patientUserId, medicationName, scheduledTime } = payload;

    if (!patientUserId || !medicationName || !scheduledTime) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patientUserId, medicationName, scheduledTime" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Processing missed dose alert for patient " + patientUserId + ", medication: " + medicationName);

    // Get patient profile
    const { data: patientProfile, error: patientError } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("user_id", patientUserId)
      .maybeSingle();

    if (patientError || !patientProfile) {
      console.error("Error fetching patient profile:", patientError);
      return new Response(
        JSON.stringify({ error: "Patient not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const patientName = ((patientProfile.first_name || "") + " " + (patientProfile.last_name || "")).trim() || "Patient";

    // Get all caregivers for this patient
    const { data: caregiverRelations, error: caregiversError } = await supabase
      .from("caregiver_invitations")
      .select("caregiver_user_id")
      .eq("patient_user_id", patientUserId)
      .eq("status", "accepted");

    if (caregiversError) {
      console.error("Error fetching caregivers:", caregiversError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch caregivers" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!caregiverRelations || caregiverRelations.length === 0) {
      console.log("No caregivers found for this patient");
      return new Response(
        JSON.stringify({ success: true, notified: 0, reason: "no_caregivers" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const caregiverIds = caregiverRelations.map(c => c.caregiver_user_id).filter(Boolean);

    // Get caregiver profiles
    const { data: caregiverProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, first_name, last_name, email, phone")
      .in("user_id", caregiverIds);

    if (profilesError) {
      console.error("Error fetching caregiver profiles:", profilesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch caregiver profiles" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const formattedTime = new Date(scheduledTime).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const notificationResults: { email: number; whatsapp: number; failed: number } = {
      email: 0,
      whatsapp: 0,
      failed: 0,
    };

    // Send notifications to each caregiver
    for (const caregiver of caregiverProfiles || []) {
      const caregiverName = ((caregiver.first_name || "") + " " + (caregiver.last_name || "")).trim() || "Caregiver";

      // Send email if configured
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey && caregiver.email) {
        try {
          const emailHtml = '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">' +
            '<h2 style="color: #dc2626;">Missed Dose Alert</h2>' +
            '<p>Hi ' + caregiverName + ',</p>' +
            '<p><strong>' + patientName + '</strong> missed their scheduled dose:</p>' +
            '<div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0;">' +
            '<p style="margin: 0;"><strong>Medication:</strong> ' + medicationName + '</p>' +
            '<p style="margin: 8px 0 0 0;"><strong>Scheduled Time:</strong> ' + formattedTime + '</p>' +
            '</div>' +
            '<p>You may want to check in with them to ensure they are okay.</p>' +
            '<p style="color: #666; font-size: 14px; margin-top: 24px;">— The Pillaxia Care Team</p>' +
            '</div>';

          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + resendApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Pillaxia <notifications@resend.dev>",
              to: [caregiver.email],
              subject: "Missed Dose Alert: " + patientName,
              html: emailHtml,
            }),
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error("Resend API error: " + errorData);
          }
          notificationResults.email++;
          console.log("Email sent to caregiver " + caregiver.user_id);
        } catch (emailError) {
          console.error("Failed to send email to " + caregiver.email + ":", emailError);
          notificationResults.failed++;
        }
      }

      // Send WhatsApp if configured
      const whatsappToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      if (whatsappToken && whatsappPhoneId && caregiver.phone) {
        try {
          const whatsappMessage = "MISSED DOSE ALERT\n\n" + 
            patientName + " missed their " + medicationName + " scheduled for " + formattedTime + ".\n\n" +
            "Please check in with them when you can.\n\n— Pillaxia";

          const response = await fetch(
            "https://graph.facebook.com/v17.0/" + whatsappPhoneId + "/messages",
            {
              method: "POST",
              headers: {
                "Authorization": "Bearer " + whatsappToken,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: caregiver.phone.replace(/\D/g, ""),
                type: "text",
                text: {
                  body: whatsappMessage,
                },
              }),
            }
          );

          if (response.ok) {
            notificationResults.whatsapp++;
            console.log("WhatsApp sent to caregiver " + caregiver.user_id);
          } else {
            const errorData = await response.text();
            console.error("WhatsApp API error for " + caregiver.phone + ":", errorData);
            notificationResults.failed++;
          }
        } catch (whatsappError) {
          console.error("Failed to send WhatsApp to " + caregiver.phone + ":", whatsappError);
          notificationResults.failed++;
        }
      }
    }

    console.log("Notification results:", notificationResults);

    return new Response(
      JSON.stringify({
        success: true,
        notified: notificationResults.email + notificationResults.whatsapp,
        details: notificationResults,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-missed-dose-alerts:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
