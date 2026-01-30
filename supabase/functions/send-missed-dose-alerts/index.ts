import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";
import { validateSchema, validators } from "../_shared/validation.ts";

const requestSchema = {
  patientUserId: validators.uuid(),
  medicationName: validators.string({ minLength: 1, maxLength: 200 }),
  scheduledTime: validators.string({ minLength: 1, maxLength: 50 }),
};

interface PatientPreferences {
  email_missed_alerts: boolean;
  in_app_missed_alerts: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

function isInQuietHours(prefs: PatientPreferences): boolean {
  if (!prefs.quiet_hours_enabled || !prefs.quiet_hours_start || !prefs.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);
  const start = prefs.quiet_hours_start.slice(0, 5);
  const end = prefs.quiet_hours_end.slice(0, 5);

  if (start > end) {
    return currentTime >= start || currentTime < end;
  }
  
  return currentTime >= start && currentTime < end;
}

// HTML escape utility for XSS prevention
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char: string) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return entities[char];
  });
}

serve(withSentry("send-missed-dose-alerts", async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check if missed_dose_alerts are enabled globally
  const { data: setting, error: settingError } = await supabase
    .from("notification_settings")
    .select("is_enabled")
    .eq("setting_key", "missed_dose_alerts")
    .maybeSingle();

  if (settingError) {
    console.error("Error checking notification settings:", settingError);
  }

  if (setting && !setting.is_enabled) {
    console.log("Missed dose alerts are disabled globally, skipping notification");
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: "notifications_disabled" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const body = await req.json();
  const validation = validateSchema(requestSchema, body);
  
  if (!validation.success) {
    return new Response(
      JSON.stringify({ error: validation.error, details: validation.details }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { patientUserId, medicationName, scheduledTime } = validation.data;

  console.log(`Processing missed dose alert for patient ${patientUserId}, medication: ${medicationName}`);

  // Check patient notification preferences
  const { data: patientPrefs, error: prefsError } = await supabase
    .from("patient_notification_preferences")
    .select("email_missed_alerts, in_app_missed_alerts, quiet_hours_enabled, quiet_hours_start, quiet_hours_end")
    .eq("user_id", patientUserId)
    .maybeSingle();

  if (prefsError) {
    console.error("Error fetching patient preferences:", prefsError);
  }

  if (patientPrefs && isInQuietHours(patientPrefs)) {
    console.log(`Patient ${patientUserId} is in quiet hours, skipping missed dose alert`);
    return new Response(
      JSON.stringify({ success: true, skipped: true, reason: "patient_quiet_hours" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

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
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!caregiverRelations || caregiverRelations.length === 0) {
    console.log("No caregivers found for this patient");
    return new Response(
      JSON.stringify({ success: true, notified: 0, reason: "no_caregivers" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

  const notificationResults = { email: 0, whatsapp: 0, sms: 0, failed: 0, skipped: 0 };

  // Escape values for HTML templates
  const escapedPatientName = escapeHtml(patientName);
  const escapedMedicationName = escapeHtml(medicationName);

  // Send notifications to each caregiver
  for (const caregiver of caregiverProfiles || []) {
    const caregiverName = ((caregiver.first_name || "") + " " + (caregiver.last_name || "")).trim() || "Caregiver";
    const escapedCaregiverName = escapeHtml(caregiverName);

    // Send email if configured
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey && caregiver.email) {
      try {
        const { data: notificationRecord, error: insertError } = await supabase
          .from("notification_history")
          .insert({
            user_id: caregiver.user_id,
            channel: "email",
            notification_type: "missed_dose_alert",
            title: "Missed Dose Alert: " + patientName,
            body: patientName + " missed " + medicationName + " at " + formattedTime,
            status: "pending",
            metadata: { patient_name: patientName, medication_name: medicationName, recipient_email: caregiver.email },
          })
          .select("id")
          .single();

        if (insertError || !notificationRecord) {
          throw new Error("Failed to create notification record: " + insertError?.message);
        }

        const trackingPixelUrl = `${supabaseUrl}/functions/v1/email-tracking-pixel?id=${notificationRecord.id}&uid=${caregiver.user_id}`;

        const emailHtml = '<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">' +
          '<h2 style="color: #dc2626;">Missed Dose Alert</h2>' +
          '<p>Hi ' + escapedCaregiverName + ',</p>' +
          '<p><strong>' + escapedPatientName + '</strong> missed their scheduled dose:</p>' +
          '<div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 16px 0;">' +
          '<p style="margin: 0;"><strong>Medication:</strong> ' + escapedMedicationName + '</p>' +
          '<p style="margin: 8px 0 0 0;"><strong>Scheduled Time:</strong> ' + formattedTime + '</p>' +
          '</div>' +
          '<p>You may want to check in with them to ensure they are okay.</p>' +
          '<p style="color: #666; font-size: 14px; margin-top: 24px;">— The Pillaxia Care Team</p>' +
          '</div>' +
          '<img src="' + trackingPixelUrl + '" width="1" height="1" style="display:none;" alt="" />';

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
        
        const emailData = await response.json();
        notificationResults.email++;
        console.log("Email sent to caregiver " + caregiver.user_id + ", ID: " + emailData.id);

        await supabase
          .from("notification_history")
          .update({
            status: "sent",
            metadata: { 
              patient_name: patientName, 
              medication_name: medicationName, 
              recipient_email: caregiver.email,
              resend_email_id: emailData.id,
              tracking_pixel_id: notificationRecord.id,
            },
          })
          .eq("id", notificationRecord.id);
      } catch (emailError) {
        console.error("Failed to send email to " + caregiver.email + ":", emailError);
        notificationResults.failed++;
      }
    }

    // Send WhatsApp using the dual-provider approach
    if (caregiver.phone) {
      try {
        const whatsappMessage = `⚠️ MISSED DOSE ALERT\n\n${patientName} missed their ${medicationName} scheduled for ${formattedTime}.\n\nPlease check in with them when you can.\n\n— Pillaxia`;

        const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke("send-whatsapp-notification", {
          body: {
            user_id: caregiver.user_id,
            phone_number: caregiver.phone,
            message: whatsappMessage,
            notification_type: "missed_dose_alert",
            metadata: { patient_name: patientName, medication_name: medicationName },
          },
        });

        if (whatsappError) throw whatsappError;

        if (whatsappResult?.success) {
          notificationResults.whatsapp++;
          console.log("WhatsApp sent to caregiver " + caregiver.user_id + " via " + (whatsappResult.provider || "unknown"));
        } else if (whatsappResult?.skipped) {
          console.log("WhatsApp skipped for caregiver " + caregiver.user_id + ": " + (whatsappResult?.reason || "not configured"));
          notificationResults.skipped++;
        } else {
          throw new Error(whatsappResult?.error || "WhatsApp send failed");
        }
      } catch (whatsappError) {
        console.error("Failed to send WhatsApp to " + caregiver.phone + ":", whatsappError);
        notificationResults.failed++;
      }
    }

    // Send SMS if configured
    if (caregiver.phone) {
      try {
        const smsMessage = `MISSED DOSE ALERT: ${patientName} missed ${medicationName} scheduled for ${formattedTime}. Please check in with them. — Pillaxia`;

        const { data: smsResult, error: smsError } = await supabase.functions.invoke("send-sms-notification", {
          body: {
            user_id: caregiver.user_id,
            phone_number: caregiver.phone,
            message: smsMessage,
            notification_type: "missed_dose_alert",
            metadata: { patient_name: patientName, medication_name: medicationName },
          },
        });

        if (smsError) throw smsError;

        if (smsResult?.success) {
          notificationResults.sms++;
          console.log("SMS sent to caregiver " + caregiver.user_id);
        } else if (smsResult?.skipped) {
          console.log("SMS skipped for caregiver " + caregiver.user_id + ": " + (smsResult?.error || "not configured"));
          notificationResults.skipped++;
        } else {
          throw new Error(smsResult?.error || "SMS send failed");
        }
      } catch (smsError) {
        console.error("Failed to send SMS to " + caregiver.phone + ":", smsError);
        notificationResults.failed++;
      }
    }
  }

  console.log("Notification results:", notificationResults);

  // Send push notification to all caregivers
  if (caregiverIds.length > 0) {
    try {
      await supabase.functions.invoke("send-push-notification", {
        body: {
          user_ids: caregiverIds,
          payload: {
            title: "⚠️ Missed Dose Alert",
            body: `${patientName} missed ${medicationName} at ${formattedTime}`,
            tag: "missed-dose-alert",
            requireInteraction: true,
            data: { url: "/dashboard/caregiver/notifications" },
          },
        },
      });
      console.log("Web push notifications sent to caregivers");
    } catch (pushError) {
      console.error("Failed to send web push notifications:", pushError);
    }

    try {
      await supabase.functions.invoke("send-native-push", {
        body: {
          user_ids: caregiverIds,
          payload: {
            title: "⚠️ Missed Dose Alert",
            body: `${patientName} missed ${medicationName} at ${formattedTime}`,
            badge: 1,
            sound: "default",
            data: { url: "/dashboard/caregiver/notifications" },
          },
        },
      });
      console.log("Native iOS push notifications sent to caregivers");
    } catch (nativePushError) {
      console.error("Failed to send native iOS push notifications:", nativePushError);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      notified: notificationResults.email + notificationResults.whatsapp + notificationResults.sms,
      details: notificationResults,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}));
