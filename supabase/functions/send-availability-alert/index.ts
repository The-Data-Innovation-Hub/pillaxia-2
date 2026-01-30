import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { validators, validateSchema, validationErrorResponse } from "../_shared/validation.ts";

// Input validation schema
const alertRequestSchema = {
  availability_id: validators.uuid(),
  medication_name: validators.string({ minLength: 1, maxLength: 200 }),
  pharmacy_id: validators.uuid(),
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

serve(withSentry("send-availability-alert", async (req) => {
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const body = await req.json();
    const validation = validateSchema(alertRequestSchema, body);
    
    if (!validation.success) {
      return validationErrorResponse(validation, corsHeaders);
    }

    const { availability_id, medication_name, pharmacy_id } = validation.data;

    console.log(`Processing availability alert for: ${medication_name} at pharmacy ${pharmacy_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pharmacy details
    const { data: pharmacy, error: pharmacyError } = await supabase
      .from("pharmacy_locations")
      .select("name, city, state, phone")
      .eq("id", pharmacy_id)
      .single();

    if (pharmacyError) {
      console.error("Failed to fetch pharmacy:", pharmacyError);
      captureException(new Error(`Failed to fetch pharmacy: ${pharmacyError.message}`));
      throw pharmacyError;
    }

    // Get medication availability details
    const { data: availability, error: availError } = await supabase
      .from("medication_availability")
      .select("dosage, form, price_naira")
      .eq("id", availability_id)
      .single();

    if (availError) {
      console.error("Failed to fetch availability:", availError);
    }

    // Find patients who:
    // 1. Have this pharmacy as preferred
    // 2. Have an active alert for this medication (case-insensitive match)
    const { data: subscriptions, error: subError } = await supabase
      .from("patient_preferred_pharmacies")
      .select(`
        patient_user_id,
        medication_availability_alerts!inner (
          id,
          medication_name,
          notify_email,
          notify_sms,
          notify_whatsapp,
          notify_push
        )
      `)
      .eq("pharmacy_id", pharmacy_id);

    if (subError) {
      console.error("Failed to fetch subscriptions:", subError);
      captureException(new Error(`Failed to fetch subscriptions: ${subError.message}`));
      throw subError;
    }

    // Filter to patients with matching medication alerts
    const matchingPatients: {
      patientId: string;
      alertId: string;
      notifyEmail: boolean;
      notifySms: boolean;
      notifyWhatsapp: boolean;
      notifyPush: boolean;
    }[] = [];

    for (const sub of subscriptions || []) {
      const alerts = sub.medication_availability_alerts as unknown as {
        id: string;
        medication_name: string;
        notify_email: boolean;
        notify_sms: boolean;
        notify_whatsapp: boolean;
        notify_push: boolean;
      }[];

      for (const alert of alerts) {
        // Case-insensitive partial match
        if (medication_name.toLowerCase().includes(alert.medication_name.toLowerCase()) ||
            alert.medication_name.toLowerCase().includes(medication_name.toLowerCase())) {
          matchingPatients.push({
            patientId: sub.patient_user_id,
            alertId: alert.id,
            notifyEmail: alert.notify_email,
            notifySms: alert.notify_sms,
            notifyWhatsapp: alert.notify_whatsapp,
            notifyPush: alert.notify_push,
          });
        }
      }
    }

    console.log(`Found ${matchingPatients.length} patients to notify`);

    const notificationPromises: Promise<unknown>[] = [];

    for (const patient of matchingPatients) {
      // Check if already notified recently (within 24 hours)
      const { data: recentNotif } = await supabase
        .from("availability_notification_history")
        .select("id")
        .eq("alert_id", patient.alertId)
        .eq("availability_id", availability_id)
        .gte("notified_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (recentNotif) {
        console.log(`Patient ${patient.patientId} already notified recently, skipping`);
        continue;
      }

      // Get patient profile and preferences
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, phone, first_name")
        .eq("user_id", patient.patientId)
        .single();

      if (!profile) continue;

      const patientName = escapeHtml(profile.first_name || "there");
      const channelsUsed: string[] = [];

      // Build notification content with escaped values
      const safeMedicationName = escapeHtml(medication_name);
      const safePharmacyName = escapeHtml(pharmacy.name || "");
      const safeCity = escapeHtml(pharmacy.city || "");
      const safeState = escapeHtml(pharmacy.state || "");
      const safePhone = escapeHtml(pharmacy.phone || "");
      const dosageInfo = availability?.dosage ? ` (${escapeHtml(availability.dosage)})` : "";
      const formInfo = availability?.form ? escapeHtml(availability.form) : "";
      const priceInfo = availability?.price_naira ? ` - ₦${availability.price_naira.toLocaleString()}` : "";
      const subject = `${safeMedicationName}${dosageInfo} is now available!`;
      const message = `Good news, ${patientName}! ${safeMedicationName}${dosageInfo} is now in stock at ${safePharmacyName} in ${safeCity}, ${safeState}.${priceInfo}${safePhone ? ` Contact: ${safePhone}` : ""}`;

      // Send Email
      if (patient.notifyEmail && profile.email) {
        notificationPromises.push(
          supabase.functions.invoke("send-encouragement-email", {
            body: {
              email: profile.email,
              subject,
              body: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">💊 Medication Available!</h1>
                  </div>
                  <div style="padding: 30px; background: #f9fafb; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px; color: #374151;">Hi ${patientName},</p>
                    <p style="font-size: 16px; color: #374151;">Great news! A medication you've been looking for is now in stock:</p>
                    <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
                      <p style="margin: 0 0 10px 0;"><strong style="font-size: 18px; color: #059669;">${safeMedicationName}${dosageInfo}</strong></p>
                      ${formInfo ? `<p style="margin: 0 0 5px 0; color: #6b7280;">Form: ${formInfo}</p>` : ""}
                      ${priceInfo ? `<p style="margin: 0 0 5px 0; color: #059669; font-weight: bold;">Price: ₦${availability?.price_naira?.toLocaleString()}</p>` : ""}
                    </div>
                    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <p style="margin: 0 0 5px 0;"><strong>📍 ${safePharmacyName}</strong></p>
                      <p style="margin: 0 0 5px 0; color: #6b7280;">${safeCity}, ${safeState}</p>
                      ${safePhone ? `<p style="margin: 0; color: #6b7280;">📞 ${safePhone}</p>` : ""}
                    </div>
                    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">Act fast - medication availability may change. Visit your preferred pharmacy soon!</p>
                  </div>
                </div>
              `,
            },
          }).then(() => {
            channelsUsed.push("email");
          }).catch((err) => {
            console.error("Email error:", err);
            captureException(err instanceof Error ? err : new Error(String(err)));
          })
        );
      }

      // Send SMS
      if (patient.notifySms && profile.phone) {
        const smsMessage = `Pillaxia: ${medication_name}${availability?.dosage ? ` (${availability.dosage})` : ""} is now available at ${pharmacy.name}, ${pharmacy.city}.${priceInfo ? ` Price: ₦${availability?.price_naira?.toLocaleString()}` : ""} Visit soon!`;
        notificationPromises.push(
          supabase.functions.invoke("send-sms-notification", {
            body: { to: profile.phone, message: smsMessage },
          }).then(() => {
            channelsUsed.push("sms");
          }).catch((err) => {
            console.error("SMS error:", err);
            captureException(err instanceof Error ? err : new Error(String(err)));
          })
        );
      }

      // Send WhatsApp
      if (patient.notifyWhatsapp && profile.phone) {
        const whatsappMessage = `💊 Good news! ${medication_name}${availability?.dosage ? ` (${availability.dosage})` : ""} is now available at ${pharmacy.name} in ${pharmacy.city}, ${pharmacy.state}.${priceInfo ? ` Price: ₦${availability?.price_naira?.toLocaleString()}` : ""}${pharmacy.phone ? ` Call: ${pharmacy.phone}` : ""} - Pillaxia`;
        notificationPromises.push(
          supabase.functions.invoke("send-whatsapp-notification", {
            body: {
              recipientId: patient.patientId,
              senderName: "Pillaxia",
              message: whatsappMessage,
              notificationType: "medication_reminder",
            },
          }).then(() => {
            channelsUsed.push("whatsapp");
          }).catch((err) => {
            console.error("WhatsApp error:", err);
            captureException(err instanceof Error ? err : new Error(String(err)));
          })
        );
      }

      // Send Push
      if (patient.notifyPush) {
        notificationPromises.push(
          supabase.functions.invoke("send-push-notification", {
            body: {
              user_id: patient.patientId,
              title: `${medication_name} Available!`,
              body: `Now in stock at ${pharmacy.name}, ${pharmacy.city}`,
              data: { type: "availability_alert", pharmacy_id },
            },
          }).then(() => {
            channelsUsed.push("push");
          }).catch((err) => {
            console.error("Push error:", err);
            captureException(err instanceof Error ? err : new Error(String(err)));
          })
        );
      }

      // Log notification
      await supabase.from("availability_notification_history").insert({
        alert_id: patient.alertId,
        availability_id,
        patient_user_id: patient.patientId,
        channels_used: channelsUsed,
      });

      // Also log to general notification history
      await supabase.from("notification_history").insert({
        user_id: patient.patientId,
        notification_type: "availability_alert",
        channel: channelsUsed.join(",") || "none",
        title: subject,
        body: message,
        status: "sent",
        metadata: {
          medication_name,
          pharmacy_id,
          pharmacy_name: pharmacy.name,
          availability_id,
        },
      });
    }

    await Promise.allSettled(notificationPromises);

    console.log(`Completed sending availability alerts to ${matchingPatients.length} patients`);

    return new Response(
      JSON.stringify({ success: true, notified: matchingPatients.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-availability-alert:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
