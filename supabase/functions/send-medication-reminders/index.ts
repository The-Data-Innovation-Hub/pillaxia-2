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
  
  return res.json();
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

    console.log(`Sending reminders to ${dosesByUser.size} users`);

    const emailResults: { userId: string; email: string; success: boolean; result?: unknown; error?: string }[] = [];

    for (const [userId, userDoses] of dosesByUser) {
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
      } catch (emailError) {
        console.error(`Failed to send email to ${profile.email}:`, emailError);
        emailResults.push({ userId, email: profile.email, success: false, error: String(emailError) });
      }
    }

    const successCount = emailResults.filter((r) => r.success).length;
    console.log(`Sent ${successCount}/${emailResults.length} reminder emails`);

    return new Response(
      JSON.stringify({
        message: `Processed ${doses.length} doses, sent ${successCount} emails`,
        results: emailResults,
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
