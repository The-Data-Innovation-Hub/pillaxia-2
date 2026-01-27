import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProfileWithLicense {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  license_number: string | null;
  license_expiration_date: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking for expiring licenses...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date
    const today = new Date();
    
    // Calculate target dates for reminders (90, 30, 7 days from now)
    const reminderDays = [90, 30, 7];
    const targetDates = reminderDays.map(days => {
      const date = new Date(today);
      date.setDate(date.getDate() + days);
      return {
        days,
        date: date.toISOString().split("T")[0],
      };
    });

    console.log("Checking for licenses expiring on:", targetDates);

    let totalReminders = 0;

    for (const target of targetDates) {
      // Find profiles with licenses expiring on this target date
      const { data: expiringProfiles, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, license_number, license_expiration_date")
        .eq("license_expiration_date", target.date)
        .not("license_number", "is", null)
        .not("email", "is", null) as { data: ProfileWithLicense[] | null; error: any };

      if (error) {
        console.error("Error fetching profiles:", error);
        continue;
      }

      if (!expiringProfiles || expiringProfiles.length === 0) {
        console.log(`No licenses expiring in ${target.days} days`);
        continue;
      }

      console.log(`Found ${expiringProfiles.length} licenses expiring in ${target.days} days`);

      // Send email reminders
      if (resendApiKey) {
        const resend = new Resend(resendApiKey);

        for (const profile of expiringProfiles) {
          if (!profile.email) continue;

          const urgency = target.days <= 7 ? "URGENT" : target.days <= 30 ? "Important" : "Reminder";
          const name = profile.first_name ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "Healthcare Professional";

          try {
            await resend.emails.send({
              from: "PillaxiaRx <noreply@pillaxia.com>",
              to: [profile.email],
              subject: `${urgency}: Your License Expires in ${target.days} Days`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: ${target.days <= 7 ? '#dc2626' : target.days <= 30 ? '#f59e0b' : '#6366f1'};">
                    License Renewal ${urgency}
                  </h1>
                  <p>Dear ${name},</p>
                  <p>This is a ${target.days <= 7 ? '<strong>final reminder</strong>' : 'friendly reminder'} that your professional license is expiring soon.</p>
                  
                  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>License Number:</strong> ${profile.license_number}</p>
                    <p style="margin: 10px 0 0 0;"><strong>Expiration Date:</strong> ${new Date(profile.license_expiration_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p style="margin: 10px 0 0 0;"><strong>Days Remaining:</strong> ${target.days} days</p>
                  </div>

                  ${target.days <= 7 ? `
                    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                      <strong>⚠️ Urgent Action Required</strong>
                      <p style="margin: 10px 0 0 0;">Your license will expire very soon. Please initiate the renewal process immediately to avoid any disruption to your practice.</p>
                    </div>
                  ` : ''}

                  <p>Please take the necessary steps to renew your license before the expiration date to ensure uninterrupted service.</p>
                  
                  <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                    This is an automated reminder from PillaxiaRx. If you have already renewed your license, please update your profile to reflect the new expiration date.
                  </p>
                </div>
              `,
            });

            // Log notification
            await supabase.from("notification_history").insert({
              user_id: profile.user_id,
              channel: "email",
              notification_type: "license_renewal_reminder",
              title: `License Renewal ${urgency}`,
              body: `Your license (${profile.license_number}) expires in ${target.days} days on ${profile.license_expiration_date}`,
              status: "sent",
              delivered_at: new Date().toISOString(),
              metadata: {
                license_number: profile.license_number,
                expiration_date: profile.license_expiration_date,
                days_until_expiry: target.days,
              },
            });

            totalReminders++;
            console.log(`Sent reminder to ${profile.email} for license expiring in ${target.days} days`);
          } catch (emailError) {
            console.error(`Failed to send email to ${profile.email}:`, emailError);
          }
        }
      } else {
        console.log("RESEND_API_KEY not configured, skipping email notifications");
      }
    }

    console.log(`License renewal check complete. Sent ${totalReminders} reminders.`);

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: totalReminders,
        checked_dates: targetDates.map(t => t.date),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-license-renewals:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
