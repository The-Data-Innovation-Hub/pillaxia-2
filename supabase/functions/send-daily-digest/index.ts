import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { format, subDays, startOfDay, endOfDay } from "https://esm.sh/date-fns@3.6.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Daily Email Digest
 * 
 * Sends a summary email to patients with:
 * - Yesterday's adherence summary
 * - Today's scheduled medications
 * - Any missed doses from yesterday
 * - Encouragement messages received
 * 
 * Designed to be called by a cron job at 8am local time.
 */

interface DigestData {
  takenCount: number;
  missedCount: number;
  totalScheduled: number;
  todayMedications: Array<{
    name: string;
    dosage: string;
    time: string;
  }>;
  missedMedications: Array<{
    name: string;
    scheduledTime: string;
  }>;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const yesterday = subDays(new Date(), 1);
    const yesterdayStart = startOfDay(yesterday).toISOString();
    const yesterdayEnd = endOfDay(yesterday).toISOString();
    const today = new Date();
    const todayDayOfWeek = today.getDay();

    // Get all patients who have digest preference enabled (or default to enabled)
    const { data: patients, error: patientsError } = await supabase
      .from("profiles")
      .select(`
        user_id,
        email,
        first_name,
        patient_notification_preferences(email_reminders)
      `)
      .not("email", "is", null);

    if (patientsError) {
      console.error("Error fetching patients:", patientsError);
      throw patientsError;
    }

    console.log(`Processing daily digest for ${patients?.length || 0} patients`);

    let sentCount = 0;
    let skippedCount = 0;

    for (const patient of patients || []) {
      try {
        // Check if patient has email reminders enabled
        const prefs = patient.patient_notification_preferences?.[0];
        if (prefs && !prefs.email_reminders) {
          skippedCount++;
          continue;
        }

        // Get yesterday's medication logs
        const { data: logs } = await supabase
          .from("medication_logs")
          .select(`
            status,
            scheduled_time,
            medications(name)
          `)
          .eq("user_id", patient.user_id)
          .gte("scheduled_time", yesterdayStart)
          .lte("scheduled_time", yesterdayEnd);

        // Get today's scheduled medications
        const { data: schedules } = await supabase
          .from("medication_schedules")
          .select(`
            time_of_day,
            quantity,
            days_of_week,
            medications(name, dosage, dosage_unit)
          `)
          .eq("user_id", patient.user_id)
          .eq("is_active", true);

        // Filter schedules for today
        const todaySchedules = schedules?.filter(s => 
          !s.days_of_week || s.days_of_week.includes(todayDayOfWeek)
        ) || [];

        // Calculate adherence stats
        const takenCount = logs?.filter(l => l.status === "taken").length || 0;
        const missedCount = logs?.filter(l => l.status === "missed").length || 0;
        const totalScheduled = logs?.length || 0;

        // Skip if no medications
        if (totalScheduled === 0 && todaySchedules.length === 0) {
          skippedCount++;
          continue;
        }

        // Prepare missed medications list
        const missedMedications = logs
          ?.filter(l => l.status === "missed")
          .map(l => {
            const med = l.medications as unknown as { name: string } | null;
            return {
              name: med?.name || "Unknown",
              scheduledTime: format(new Date(l.scheduled_time), "h:mm a"),
            };
          }) || [];

        // Prepare today's schedule
        const todayMedications = todaySchedules.map(s => {
          const med = s.medications as unknown as { name: string; dosage: string; dosage_unit: string } | null;
          return {
            name: med?.name || "Unknown",
            dosage: `${med?.dosage || ""} ${med?.dosage_unit || ""}`.trim(),
            time: s.time_of_day.slice(0, 5),
          };
        }).sort((a, b) => a.time.localeCompare(b.time));

        // Calculate adherence percentage
        const adherencePercent = totalScheduled > 0 
          ? Math.round((takenCount / totalScheduled) * 100) 
          : 100;

        // Create notification record
        const { data: notificationRecord } = await supabase
          .from("notification_history")
          .insert({
            user_id: patient.user_id,
            channel: "email",
            notification_type: "daily_digest",
            title: "Your Daily Medication Summary",
            body: `Yesterday: ${takenCount}/${totalScheduled} taken (${adherencePercent}%). Today: ${todayMedications.length} scheduled.`,
            status: "pending",
            metadata: { recipient_email: patient.email },
          })
          .select("id")
          .single();

        const trackingPixelUrl = notificationRecord 
          ? `${supabaseUrl}/functions/v1/email-tracking-pixel?id=${notificationRecord.id}&uid=${patient.user_id}`
          : "";

        const clickTrackerBase = `${supabaseUrl}/functions/v1/email-click-tracker?id=${notificationRecord?.id}&uid=${patient.user_id}&url=`;

        // Generate email HTML
        const emailHtml = generateDigestEmail({
          patientName: patient.first_name || "there",
          yesterday: format(yesterday, "MMMM d"),
          today: format(today, "EEEE, MMMM d"),
          adherencePercent,
          takenCount,
          missedCount,
          totalScheduled,
          todayMedications,
          missedMedications,
          trackingPixelUrl,
          clickTrackerBase,
        });

        // Send email
        const emailResponse = await resend.emails.send({
          from: "Pillaxia <noreply@resend.dev>",
          to: [patient.email!],
          subject: `📊 Your Daily Medication Summary - ${format(today, "MMM d")}`,
          html: emailHtml,
        });

        if (emailResponse.error) {
          console.error(`Failed to send digest to ${patient.email}:`, emailResponse.error);
          if (notificationRecord) {
            await supabase
              .from("notification_history")
              .update({ status: "failed", error_message: emailResponse.error.message })
              .eq("id", notificationRecord.id);
          }
        } else {
          console.log(`Digest sent to ${patient.email}`);
          sentCount++;
          if (notificationRecord) {
            await supabase
              .from("notification_history")
              .update({ 
                status: "sent", 
                metadata: { 
                  recipient_email: patient.email,
                  resend_email_id: emailResponse.data?.id,
                  tracking_pixel_id: notificationRecord.id,
                },
              })
              .eq("id", notificationRecord.id);
          }
        }
      } catch (patientError) {
        console.error(`Error processing patient ${patient.user_id}:`, patientError);
      }
    }

    console.log(`Daily digest complete: ${sentCount} sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, skipped: skippedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-daily-digest:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface EmailParams {
  patientName: string;
  yesterday: string;
  today: string;
  adherencePercent: number;
  takenCount: number;
  missedCount: number;
  totalScheduled: number;
  todayMedications: Array<{ name: string; dosage: string; time: string }>;
  missedMedications: Array<{ name: string; scheduledTime: string }>;
  trackingPixelUrl: string;
  clickTrackerBase: string;
}

function generateDigestEmail(params: EmailParams): string {
  const {
    patientName,
    yesterday,
    today,
    adherencePercent,
    takenCount,
    missedCount,
    totalScheduled,
    todayMedications,
    missedMedications,
    trackingPixelUrl,
    clickTrackerBase,
  } = params;

  const adherenceColor = adherencePercent >= 80 ? "#22C55E" : adherencePercent >= 50 ? "#F59E0B" : "#EF4444";
  const adherenceEmoji = adherencePercent >= 80 ? "🌟" : adherencePercent >= 50 ? "💪" : "🎯";

  const todayMedsHtml = todayMedications.length > 0
    ? todayMedications.map(m => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${m.name}</strong><br>
            <span style="color: #6b7280; font-size: 14px;">${m.dosage}</span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            ${m.time}
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="2" style="padding: 16px; text-align: center; color: #6b7280;">No medications scheduled for today</td></tr>`;

  const missedMedsHtml = missedMedications.length > 0
    ? `
      <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin-top: 20px;">
        <h3 style="margin: 0 0 12px 0; color: #DC2626; font-size: 16px;">⚠️ Missed Yesterday</h3>
        <ul style="margin: 0; padding-left: 20px; color: #7F1D1D;">
          ${missedMedications.map(m => `<li>${m.name} at ${m.scheduledTime}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f3f4f6;">
      <div style="background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
        <h1 style="color: #22d3ee; margin: 0; font-size: 24px;">📊 Daily Summary</h1>
        <p style="color: #e2e8f0; margin: 8px 0 0 0;">${today}</p>
      </div>
      
      <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="font-size: 16px; margin: 0 0 20px 0;">
          Good morning, ${patientName}! 👋
        </p>
        
        <!-- Yesterday's Summary -->
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 16px 0; color: #374151;">Yesterday (${yesterday})</h3>
          <div style="display: flex; gap: 16px; text-align: center;">
            <div style="flex: 1; background: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
              <div style="font-size: 32px; font-weight: bold; color: ${adherenceColor};">${adherencePercent}%</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${adherenceEmoji} Adherence</div>
            </div>
            <div style="flex: 1; background: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
              <div style="font-size: 32px; font-weight: bold; color: #22C55E;">${takenCount}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">✓ Taken</div>
            </div>
            <div style="flex: 1; background: white; border-radius: 8px; padding: 16px; border: 1px solid #e5e7eb;">
              <div style="font-size: 32px; font-weight: bold; color: ${missedCount > 0 ? '#EF4444' : '#22C55E'};">${missedCount}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">✗ Missed</div>
            </div>
          </div>
          ${missedMedsHtml}
        </div>
        
        <!-- Today's Schedule -->
        <h3 style="margin: 0 0 16px 0; color: #374151;">📅 Today's Schedule</h3>
        <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #e5e7eb;">
              <th style="padding: 12px; text-align: left; font-weight: 600;">Medication</th>
              <th style="padding: 12px; text-align: right; font-weight: 600;">Time</th>
            </tr>
          </thead>
          <tbody>
            ${todayMedsHtml}
          </tbody>
        </table>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin-top: 24px;">
          <a href="${clickTrackerBase}${encodeURIComponent('https://pillaxia.com/dashboard')}" 
             style="display: inline-block; background: linear-gradient(135deg, #8B5CF6, #A855F7); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Open Pillaxia Dashboard →
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
          You're receiving this daily digest because you have email notifications enabled.<br>
          <a href="${clickTrackerBase}${encodeURIComponent('https://pillaxia.com/dashboard/settings')}" style="color: #8B5CF6;">Manage your notification preferences</a>
        </p>
      </div>
      
      <!-- Tracking pixel -->
      ${trackingPixelUrl ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />` : ""}
    </body>
    </html>
  `;
}
