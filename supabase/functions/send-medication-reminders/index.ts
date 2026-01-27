import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string[], subject: string, html: string): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Pillaxia <noreply@thedatainnovationhub.com>",
      to,
      subject,
      html,
    }),
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend API error: ${error}`);
  }
  
  const data = await res.json();
  return { id: data.id };
}

interface MedicationInfo {
  name: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  instructions: string | null;
}

interface ScheduleInfo {
  quantity: number;
  with_food: boolean;
}

interface MedicationDose {
  id: string;
  scheduled_time: string;
  user_id: string;
  medications: MedicationInfo | MedicationInfo[] | null;
  medication_schedules: ScheduleInfo | ScheduleInfo[] | null;
}

interface PatientPreferences {
  email_reminders: boolean;
  sms_reminders: boolean;
  whatsapp_reminders: boolean;
  in_app_reminders: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

function isInQuietHours(prefs: PatientPreferences): boolean {
  if (!prefs.quiet_hours_enabled || !prefs.quiet_hours_start || !prefs.quiet_hours_end) {
    return false;
  }

  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
  const start = prefs.quiet_hours_start.slice(0, 5);
  const end = prefs.quiet_hours_end.slice(0, 5);

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }
  
  return currentTime >= start && currentTime < end;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting medication reminder job...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if medication reminders are enabled globally
    const { data: settingData, error: settingError } = await supabase
      .from("notification_settings")
      .select("is_enabled")
      .eq("setting_key", "medication_reminders")
      .maybeSingle();

    if (settingError) {
      console.error("Error checking notification settings:", settingError);
    }

    if (settingData && !settingData.is_enabled) {
      console.log("Medication reminders are disabled globally, skipping...");
      return new Response(
        JSON.stringify({ message: "Medication reminders are disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current time and look 30 minutes ahead for upcoming doses
    const now = new Date();
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);

    console.log(`Looking for doses between ${now.toISOString()} and ${thirtyMinutesLater.toISOString()}`);

    // Find pending medication logs that are scheduled within the next 30 minutes
    const { data: upcomingDoses, error: dosesError } = await supabase
      .from("medication_logs")
      .select(`
        id,
        scheduled_time,
        user_id,
        medications (name, dosage, dosage_unit, form, instructions),
        medication_schedules (quantity, with_food)
      `)
      .eq("status", "pending")
      .gte("scheduled_time", now.toISOString())
      .lte("scheduled_time", thirtyMinutesLater.toISOString());

    if (dosesError) {
      console.error("Error fetching doses:", dosesError);
      throw dosesError;
    }

    const doses = upcomingDoses as MedicationDose[] | null;

    console.log(`Found ${doses?.length || 0} upcoming doses`);

    if (!doses || doses.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming doses to remind" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group doses by user
    const dosesByUser = new Map<string, MedicationDose[]>();
    for (const dose of doses) {
      const existing = dosesByUser.get(dose.user_id) || [];
      existing.push(dose);
      dosesByUser.set(dose.user_id, existing);
    }

    // Get all user IDs to fetch their preferences
    const userIds = Array.from(dosesByUser.keys());

    // Fetch patient notification preferences for all users
    const { data: allPreferences, error: prefsError } = await supabase
      .from("patient_notification_preferences")
      .select("user_id, email_reminders, sms_reminders, whatsapp_reminders, in_app_reminders, quiet_hours_enabled, quiet_hours_start, quiet_hours_end")
      .in("user_id", userIds);

    if (prefsError) {
      console.error("Error fetching patient preferences:", prefsError);
    }

    // Create a map of user preferences
    const preferencesMap = new Map<string, PatientPreferences>();
    if (allPreferences) {
      for (const pref of allPreferences) {
        preferencesMap.set(pref.user_id, pref);
      }
    }

    console.log(`Sending reminders to ${dosesByUser.size} users`);

    const emailResults: { userId: string; email: string; success: boolean; result?: unknown; error?: string; skipped?: string }[] = [];
    const smsResults: { userId: string; success: boolean; error?: string; skipped?: string }[] = [];
    const whatsappResults: { userId: string; success: boolean; error?: string; skipped?: string }[] = [];

    for (const [userId, userDoses] of dosesByUser) {
      // Check patient notification preferences
      const prefs = preferencesMap.get(userId);
      
      // Default to sending if no preferences exist
      if (prefs) {
        // Check if email reminders are disabled
        if (!prefs.email_reminders) {
          console.log(`User ${userId} has email reminders disabled, skipping...`);
          emailResults.push({ userId, email: "", success: true, skipped: "email_reminders_disabled" });
          continue;
        }

        // Check quiet hours
        if (isInQuietHours(prefs)) {
          console.log(`User ${userId} is in quiet hours, skipping...`);
          emailResults.push({ userId, email: "", success: true, skipped: "quiet_hours" });
          continue;
        }
      }

      // Get user's profile for email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, first_name")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError || !profile?.email) {
        console.error(`Could not find email for user ${userId}:`, profileError);
        continue;
      }

      // Build medication list HTML
      const medicationListHtml = userDoses.map((dose) => {
        const medsData = dose.medications;
        const schedulesData = dose.medication_schedules;
        
        // Handle both array and object formats from Supabase
        const med: MedicationInfo | null = Array.isArray(medsData) 
          ? (medsData[0] || null) 
          : medsData;
        const schedule: ScheduleInfo | null = Array.isArray(schedulesData) 
          ? (schedulesData[0] || null) 
          : schedulesData;
        
        if (!med) return "";
        
        const scheduledTime = new Date(dose.scheduled_time).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });

        return `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
              <strong>${med.name}</strong><br/>
              <span style="color: #6b7280; font-size: 14px;">
                ${schedule?.quantity || 1}x ${med.dosage} ${med.dosage_unit} ${med.form}
                ${schedule?.with_food ? " • Take with food" : ""}
              </span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
              <strong>${scheduledTime}</strong>
            </td>
          </tr>
        `;
      }).join("");

      const firstName = profile.first_name || "there";

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #1f2937; font-size: 24px; margin: 0;">💊 Medication Reminder</h1>
              </div>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.5;">
                Hi ${firstName},
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.5;">
                You have upcoming medication${userDoses.length > 1 ? "s" : ""} to take soon:
              </p>

              <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Medication</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Time</th>
                  </tr>
                </thead>
                <tbody>
                  ${medicationListHtml}
                </tbody>
              </table>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-top: 24px;">
                Remember to mark your doses as taken in the Pillaxia app to track your adherence.
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

              <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                This reminder was sent by Pillaxia. If you no longer wish to receive these reminders, 
                please update your notification preferences in the app.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const emailResult = await sendEmail(
          [profile.email],
          `💊 Medication Reminder: ${userDoses.length} dose${userDoses.length > 1 ? "s" : ""} coming up`,
          emailHtml
        );

        console.log(`Email sent to ${profile.email}:`, emailResult);
        emailResults.push({ userId, email: profile.email, success: true, result: emailResult });

        // Log successful email notification with Resend email ID for webhook tracking
        await supabase.from("notification_history").insert({
          user_id: userId,
          channel: "email",
          notification_type: "medication_reminder",
          title: `Medication Reminder: ${userDoses.length} dose${userDoses.length > 1 ? "s" : ""}`,
          body: `Upcoming medication${userDoses.length > 1 ? "s" : ""} to take soon`,
          status: "sent",
          metadata: { 
            recipient_email: profile.email, 
            dose_count: userDoses.length,
            resend_email_id: emailResult.id 
          },
        });

        const medNames = userDoses.map((dose) => {
          const medsData = dose.medications;
          const med = Array.isArray(medsData) ? medsData[0] : medsData;
          return med?.name || "medication";
        }).join(", ");

        // Send push notification if in_app_reminders is enabled
        if (!prefs || prefs.in_app_reminders) {
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
        }

        // Send SMS notification if sms_reminders is enabled
        if (!prefs || prefs.sms_reminders) {
          try {
            const smsMessage = `Pillaxia Reminder: Time to take ${medNames}. ${userDoses.length} dose${userDoses.length > 1 ? "s" : ""} scheduled now.`;
            
            const { data: smsData, error: smsError } = await supabase.functions.invoke("send-sms-notification", {
              body: {
                user_id: userId,
                message: smsMessage,
                notification_type: "medication_reminder",
                metadata: { dose_count: userDoses.length },
              },
            });

            if (smsError) {
              console.error(`SMS error for user ${userId}:`, smsError);
              smsResults.push({ userId, success: false, error: String(smsError) });
            } else if (smsData?.skipped) {
              console.log(`SMS skipped for user ${userId}: ${smsData.error || "no phone"}`);
              smsResults.push({ userId, success: true, skipped: smsData.error });
            } else {
              console.log(`SMS reminder sent to user ${userId}`);
              smsResults.push({ userId, success: true });
            }
          } catch (smsErr) {
            console.error(`SMS exception for user ${userId}:`, smsErr);
            smsResults.push({ userId, success: false, error: String(smsErr) });
          }
        } else {
          smsResults.push({ userId, success: true, skipped: "sms_reminders_disabled" });
        }

        // Send WhatsApp notification if whatsapp_reminders is enabled
        if (!prefs || prefs.whatsapp_reminders) {
          try {
            const whatsappMessage = `Time to take ${medNames}. ${userDoses.length} dose${userDoses.length > 1 ? "s" : ""} scheduled now.`;
            
            const { data: waData, error: waError } = await supabase.functions.invoke("send-whatsapp-notification", {
              body: {
                recipientId: userId,
                senderName: "Pillaxia",
                message: whatsappMessage,
                notificationType: "medication_reminder",
              },
            });

            if (waError) {
              console.error(`WhatsApp error for user ${userId}:`, waError);
              whatsappResults.push({ userId, success: false, error: String(waError) });
            } else if (waData?.reason === "no_phone" || waData?.reason === "not_configured" || waData?.reason === "user_disabled") {
              console.log(`WhatsApp skipped for user ${userId}: ${waData.reason}`);
              whatsappResults.push({ userId, success: true, skipped: waData.reason });
            } else if (waData?.success) {
              console.log(`WhatsApp reminder sent to user ${userId} via ${waData.provider}`);
              whatsappResults.push({ userId, success: true });
            } else {
              whatsappResults.push({ userId, success: false, error: waData?.message || "unknown" });
            }
          } catch (waErr) {
            console.error(`WhatsApp exception for user ${userId}:`, waErr);
            whatsappResults.push({ userId, success: false, error: String(waErr) });
          }
        } else {
          whatsappResults.push({ userId, success: true, skipped: "whatsapp_reminders_disabled" });
        }
      } catch (emailError) {
        console.error(`Failed to send email to ${profile.email}:`, emailError);
        emailResults.push({ userId, email: profile.email, success: false, error: String(emailError) });

        // Log failed email notification
        await supabase.from("notification_history").insert({
          user_id: userId,
          channel: "email",
          notification_type: "medication_reminder",
          title: `Medication Reminder: ${userDoses.length} dose${userDoses.length > 1 ? "s" : ""}`,
          body: `Upcoming medication${userDoses.length > 1 ? "s" : ""} to take soon`,
          status: "failed",
          error_message: String(emailError).slice(0, 500),
          metadata: { recipient_email: profile.email, dose_count: userDoses.length },
        });
      }
    }

    const successCount = emailResults.filter((r) => r.success && !r.skipped).length;
    const skippedCount = emailResults.filter((r) => r.skipped).length;
    const smsSuccessCount = smsResults.filter((r) => r.success && !r.skipped).length;
    const smsSkippedCount = smsResults.filter((r) => r.skipped).length;
    const waSuccessCount = whatsappResults.filter((r) => r.success && !r.skipped).length;
    const waSkippedCount = whatsappResults.filter((r) => r.skipped).length;
    
    console.log(`Sent ${successCount}/${emailResults.length} reminder emails, ${skippedCount} skipped`);
    console.log(`Sent ${smsSuccessCount}/${smsResults.length} reminder SMS, ${smsSkippedCount} skipped`);
    console.log(`Sent ${waSuccessCount}/${whatsappResults.length} WhatsApp messages, ${waSkippedCount} skipped`);

    return new Response(
      JSON.stringify({
        message: `Processed ${doses.length} doses, sent ${successCount} emails, ${smsSuccessCount} SMS, ${waSuccessCount} WhatsApp`,
        emailResults,
        smsResults,
        whatsappResults,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in medication reminder job:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
