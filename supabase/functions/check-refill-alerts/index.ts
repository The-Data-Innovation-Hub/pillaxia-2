import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

// HTML escape for XSS prevention
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

serve(withSentry("check-refill-alerts", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking for medications needing refills...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find medications with 3 or fewer refills remaining that are still active
    const { data: lowRefillMeds, error: medsError } = await supabase
      .from("medications")
      .select(`
        id,
        user_id,
        name,
        refills_remaining,
        pharmacy
      `)
      .eq("is_active", true)
      .lte("refills_remaining", 3)
      .gt("refills_remaining", 0);

    if (medsError) {
      console.error("Error fetching medications:", medsError);
      throw medsError;
    }

    console.log(`Found ${lowRefillMeds?.length || 0} medications with low refills`);

    if (!lowRefillMeds || lowRefillMeds.length === 0) {
      return new Response(
        JSON.stringify({ message: "No medications need refill alerts", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which users have already been notified today for each medication
    const today = new Date().toISOString().split("T")[0];

    const { data: existingNotifications } = await supabase
      .from("notification_history")
      .select("metadata")
      .eq("notification_type", "refill_alert")
      .gte("created_at", `${today}T00:00:00Z`);

    const alreadyNotifiedMedIds = new Set(
      (existingNotifications || [])
        .map((n: { metadata?: { medication_id?: string } }) => n.metadata?.medication_id)
        .filter(Boolean)
    );

    // Filter out medications already notified today
    const medsToNotify = lowRefillMeds.filter((med) => !alreadyNotifiedMedIds.has(med.id));
    console.log(`${medsToNotify.length} medications need new notifications`);

    let sentCount = 0;

    for (const med of medsToNotify) {
      // Get user profile for email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, first_name")
        .eq("user_id", med.user_id)
        .single();

      if (!profile?.email) {
        console.log(`No email for user ${med.user_id}, skipping`);
        continue;
      }

      // Check user notification preferences
      const { data: prefs } = await supabase
        .from("patient_notification_preferences")
        .select("email_reminders")
        .eq("user_id", med.user_id)
        .single();

      if (prefs && !prefs.email_reminders) {
        console.log(`User ${med.user_id} has email reminders disabled, skipping`);
        continue;
      }

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      
      if (!RESEND_API_KEY) {
        console.error("RESEND_API_KEY not configured");
        continue;
      }

      // Create notification record first
      const { data: notificationRecord, error: insertError } = await supabase
        .from("notification_history")
        .insert({
          user_id: med.user_id,
          notification_type: "refill_alert",
          channel: "email",
          title: `Refill Alert: ${med.name}`,
          body: `${med.refills_remaining} refills remaining`,
          status: "pending",
          metadata: {
            medication_id: med.id,
            medication_name: med.name,
            refills_remaining: med.refills_remaining,
            recipient_email: profile.email,
          },
        })
        .select("id")
        .single();

      if (insertError || !notificationRecord) {
        console.error(`Failed to create notification record for ${med.name}:`, insertError);
        continue;
      }

      // Generate tracking pixel URL
      const trackingPixelUrl = `${supabaseUrl}/functions/v1/email-tracking-pixel?id=${notificationRecord.id}&uid=${med.user_id}`;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Pillaxia <notifications@resend.dev>",
          to: [profile.email],
          subject: `Refill Alert: ${escapeHtml(med.name)} - ${med.refills_remaining} refills remaining`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #6366f1;">⚠️ Medication Refill Alert</h2>
              <p>Hi ${escapeHtml(profile.first_name || "there")},</p>
              <p>Your medication <strong>${escapeHtml(med.name)}</strong> has only <strong>${med.refills_remaining}</strong> refill(s) remaining.</p>
              ${med.pharmacy ? `<p>Contact your pharmacy: <strong>${escapeHtml(med.pharmacy)}</strong></p>` : ""}
              <p>Please contact your healthcare provider to renew your prescription before you run out.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #6b7280; font-size: 12px;">This is an automated reminder from Pillaxia to help you stay on track with your medications.</p>
            </div>
            <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
          `,
        }),
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        sentCount++;
        console.log(`Sent refill alert for ${med.name} to ${profile.email}`);

        await supabase
          .from("notification_history")
          .update({
            status: "sent",
            metadata: {
              medication_id: med.id,
              medication_name: med.name,
              refills_remaining: med.refills_remaining,
              recipient_email: profile.email,
              resend_email_id: emailData.id,
              tracking_pixel_id: notificationRecord.id,
            },
          })
          .eq("id", notificationRecord.id);
      } else {
        const errorText = await emailResponse.text();
        console.error(`Failed to send email for ${med.name}:`, errorText);

        await supabase
          .from("notification_history")
          .update({
            status: "failed",
            error_message: errorText.slice(0, 500),
          })
          .eq("id", notificationRecord.id);
      }
    }

    console.log(`Completed: sent ${sentCount} refill alerts`);

    return new Response(
      JSON.stringify({ message: "Refill alerts processed", sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-refill-alerts:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
