/**
 * Send Medication Reminders Edge Function
 * 
 * Orchestrates multi-channel medication reminders (email, SMS, WhatsApp, push)
 * using shared modules for reusable logic.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { sendEmail } from "../_shared/email/sendEmail.ts";
import { isInQuietHours } from "../_shared/notifications/quietHours.ts";
import { fetchUserPreferences, PatientNotificationPreferences } from "../_shared/notifications/userPreferences.ts";
import { fetchUpcomingDoses, groupDosesByUser, getMedicationNames, MedicationDose } from "../_shared/medications/upcomingDoses.ts";
import { generateMedicationReminderHtml, generateMedicationReminderSubject } from "../_shared/email/templates/medicationReminder.ts";

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

interface NotificationResult {
  userId: string;
  success: boolean;
  email?: string;
  result?: unknown;
  error?: string;
  skipped?: string;
}

interface ProfileData {
  email: string | null;
  first_name: string | null;
}

async function sendPushNotifications(
  supabase: AnySupabaseClient,
  userId: string,
  medNames: string,
  doseCount: number
): Promise<void> {
  // Web push
  await supabase.functions.invoke("send-push-notification", {
    body: {
      user_ids: [userId],
      payload: {
        title: "💊 Medication Reminder",
        body: `Time to take: ${medNames}`,
        tag: "medication-reminder",
        data: { url: "/dashboard/schedule" },
      },
    },
  });

  // Native iOS push
  try {
    await supabase.functions.invoke("send-native-push", {
      body: {
        user_ids: [userId],
        payload: {
          title: "💊 Medication Reminder",
          body: `Time to take: ${medNames}`,
          badge: doseCount,
          sound: "default",
          data: { url: "/dashboard/schedule" },
        },
      },
    });
  } catch (err) {
    console.error(`Native iOS push error for user ${userId}:`, err);
  }
}

async function sendSmsNotification(
  supabase: AnySupabaseClient,
  userId: string,
  medNames: string,
  doseCount: number
): Promise<NotificationResult> {
  try {
    const message = `Pillaxia Reminder: Time to take ${medNames}. ${doseCount} dose${doseCount > 1 ? "s" : ""} scheduled now.`;
    const { data, error } = await supabase.functions.invoke("send-sms-notification", {
      body: { user_id: userId, message, notification_type: "medication_reminder", metadata: { dose_count: doseCount } },
    });

    if (error) return { userId, success: false, error: String(error) };
    if (data?.skipped) return { userId, success: true, skipped: data.error };
    return { userId, success: true };
  } catch (err) {
    return { userId, success: false, error: String(err) };
  }
}

async function sendWhatsAppNotification(
  supabase: AnySupabaseClient,
  userId: string,
  medNames: string,
  doseCount: number
): Promise<NotificationResult> {
  try {
    const message = `Time to take ${medNames}. ${doseCount} dose${doseCount > 1 ? "s" : ""} scheduled now.`;
    const { data, error } = await supabase.functions.invoke("send-whatsapp-notification", {
      body: { recipientId: userId, senderName: "Pillaxia", message, notificationType: "medication_reminder" },
    });

    if (error) return { userId, success: false, error: String(error) };
    if (data?.reason === "no_phone" || data?.reason === "not_configured" || data?.reason === "user_disabled") {
      return { userId, success: true, skipped: data.reason };
    }
    if (data?.success) return { userId, success: true };
    return { userId, success: false, error: data?.message || "unknown" };
  } catch (err) {
    return { userId, success: false, error: String(err) };
  }
}

async function processUserReminder(
  supabase: AnySupabaseClient,
  userId: string,
  userDoses: MedicationDose[],
  prefs: PatientNotificationPreferences | undefined
): Promise<{ email: NotificationResult; sms: NotificationResult; whatsapp: NotificationResult }> {
  const medNames = getMedicationNames(userDoses);
  const doseCount = userDoses.length;

  // Check preferences and quiet hours
  if (prefs && !prefs.email_reminders) {
    return {
      email: { userId, success: true, skipped: "email_reminders_disabled" },
      sms: { userId, success: true, skipped: "email_skipped" },
      whatsapp: { userId, success: true, skipped: "email_skipped" },
    };
  }

  if (prefs && isInQuietHours(prefs)) {
    return {
      email: { userId, success: true, skipped: "quiet_hours" },
      sms: { userId, success: true, skipped: "quiet_hours" },
      whatsapp: { userId, success: true, skipped: "quiet_hours" },
    };
  }

  // Get user profile
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("email, first_name")
    .eq("user_id", userId)
    .maybeSingle();

  const profile = profileData as ProfileData | null;

  if (profileError || !profile?.email) {
    return {
      email: { userId, success: false, error: "no_email" },
      sms: { userId, success: true, skipped: "no_profile" },
      whatsapp: { userId, success: true, skipped: "no_profile" },
    };
  }

  // Send email
  let emailResult: NotificationResult;
  try {
    const html = generateMedicationReminderHtml({ firstName: profile.first_name || "there", doses: userDoses });
    const subject = generateMedicationReminderSubject(doseCount);
    const result = await sendEmail({ to: [profile.email], subject, html });

    emailResult = { userId, email: profile.email, success: true, result };

    // Log successful notification
    await supabase.from("notification_history").insert({
      user_id: userId,
      channel: "email",
      notification_type: "medication_reminder",
      title: subject,
      body: `Upcoming medication${doseCount > 1 ? "s" : ""} to take soon`,
      status: "sent",
      metadata: { recipient_email: profile.email, dose_count: doseCount, resend_email_id: result.id },
    });

    // Send push notifications if enabled
    if (!prefs || prefs.in_app_reminders) {
      await sendPushNotifications(supabase, userId, medNames, doseCount);
    }
  } catch (err) {
    emailResult = { userId, email: profile.email, success: false, error: String(err) };
    if (err instanceof Error) captureException(err);
    await supabase.from("notification_history").insert({
      user_id: userId,
      channel: "email",
      notification_type: "medication_reminder",
      title: generateMedicationReminderSubject(doseCount),
      status: "failed",
      error_message: String(err).slice(0, 500),
      metadata: { recipient_email: profile.email, dose_count: doseCount },
    });
  }

  // Send SMS and WhatsApp
  const smsResult = (!prefs || prefs.sms_reminders)
    ? await sendSmsNotification(supabase, userId, medNames, doseCount)
    : { userId, success: true, skipped: "sms_reminders_disabled" };

  const whatsappResult = (!prefs || prefs.whatsapp_reminders)
    ? await sendWhatsAppNotification(supabase, userId, medNames, doseCount)
    : { userId, success: true, skipped: "whatsapp_reminders_disabled" };

  return { email: emailResult, sms: smsResult, whatsapp: whatsappResult };
}

Deno.serve(withSentry("send-medication-reminders", async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    console.log("Starting medication reminder job...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check global setting
    const { data: settingData } = await supabase
      .from("notification_settings")
      .select("is_enabled")
      .eq("setting_key", "medication_reminders")
      .maybeSingle();

    if (settingData && !settingData.is_enabled) {
      return new Response(
        JSON.stringify({ message: "Medication reminders are disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch upcoming doses (30 min window)
    const now = new Date();
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);
    const doses = await fetchUpcomingDoses(supabase, now, thirtyMinutesLater);

    if (doses.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming doses to remind" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const dosesByUser = groupDosesByUser(doses);
    const userIds = Array.from(dosesByUser.keys());
    const preferencesMap = await fetchUserPreferences(supabase, userIds);

    console.log(`Sending reminders to ${dosesByUser.size} users`);

    const emailResults: NotificationResult[] = [];
    const smsResults: NotificationResult[] = [];
    const whatsappResults: NotificationResult[] = [];

    for (const [userId, userDoses] of dosesByUser) {
      const prefs = preferencesMap.get(userId);
      const results = await processUserReminder(supabase, userId, userDoses, prefs);
      emailResults.push(results.email);
      smsResults.push(results.sms);
      whatsappResults.push(results.whatsapp);
    }

    const summarize = (results: NotificationResult[]) => ({
      sent: results.filter(r => r.success && !r.skipped).length,
      failed: results.filter(r => !r.success).length,
      skipped: results.filter(r => r.skipped).length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          email: summarize(emailResults),
          sms: summarize(smsResults),
          whatsapp: summarize(whatsappResults),
        },
        details: emailResults,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in send-medication-reminders:", error);
    if (error instanceof Error) captureException(error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
