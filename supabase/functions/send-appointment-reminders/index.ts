import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Processing appointment reminders...");

    // Get appointments scheduled for tomorrow that haven't had reminders sent
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data: appointments, error: fetchError } = await supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", tomorrowStr)
      .eq("reminder_sent", false)
      .in("status", ["scheduled", "confirmed"]);

    if (fetchError) {
      console.error("Error fetching appointments:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${appointments?.length || 0} appointments needing reminders`);

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No appointments need reminders" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { success: number; failed: number } = { success: 0, failed: 0 };

    for (const appointment of appointments) {
      try {
        // Get patient profile
        const { data: patientProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", appointment.patient_user_id)
          .single();

        // Get clinician profile
        const { data: clinicianProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", appointment.clinician_user_id)
          .single();

        if (!patientProfile?.email) {
          console.log(`No email for patient ${appointment.patient_user_id}`);
          continue;
        }

        // Check patient notification preferences
        const { data: prefs } = await supabase
          .from("patient_notification_preferences")
          .select("email_reminders")
          .eq("user_id", appointment.patient_user_id)
          .single();

        if (prefs && !prefs.email_reminders) {
          console.log(`Patient ${appointment.patient_user_id} has email reminders disabled`);
          continue;
        }

        // Send email reminder
        if (resendApiKey) {
          const appointmentTime = appointment.appointment_time.slice(0, 5);
          const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });

          const emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0ea5e9;">Appointment Reminder</h2>
              <p>Hello ${patientProfile.first_name || "there"},</p>
              <p>This is a reminder about your upcoming appointment:</p>
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Title:</strong> ${appointment.title}</p>
                <p><strong>Date:</strong> ${appointmentDate}</p>
                <p><strong>Time:</strong> ${appointmentTime}</p>
                ${appointment.location ? `<p><strong>Location:</strong> ${appointment.location}</p>` : ""}
                ${clinicianProfile ? `<p><strong>With:</strong> Dr. ${clinicianProfile.first_name} ${clinicianProfile.last_name}</p>` : ""}
                ${appointment.description ? `<p><strong>Notes:</strong> ${appointment.description}</p>` : ""}
              </div>
              <p>Please make sure to arrive on time. If you need to reschedule or cancel, please log in to your Pillaxia account.</p>
              <p>Best regards,<br>The Pillaxia Team</p>
            </div>
          `;

          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Pillaxia <notifications@pillaxia.com>",
              to: [patientProfile.email],
              subject: `Reminder: ${appointment.title} - Tomorrow at ${appointmentTime}`,
              html: emailHtml,
            }),
          });

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error(`Failed to send email reminder: ${errorText}`);
            results.failed++;
            continue;
          }

          console.log(`Email reminder sent to ${patientProfile.email}`);
        }

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from("appointments")
          .update({ reminder_sent: true })
          .eq("id", appointment.id);

        if (updateError) {
          console.error(`Failed to update reminder_sent: ${updateError.message}`);
        }

        // Log notification
        await supabase.from("notification_history").insert({
          user_id: appointment.patient_user_id,
          channel: "email",
          notification_type: "appointment_reminder",
          title: `Appointment Reminder: ${appointment.title}`,
          body: `Your appointment is scheduled for tomorrow at ${appointment.appointment_time.slice(0, 5)}`,
          status: "sent",
          metadata: { appointment_id: appointment.id },
        });

        results.success++;
      } catch (appointmentError) {
        console.error(`Error processing appointment ${appointment.id}:`, appointmentError);
        results.failed++;
      }
    }

    console.log(`Reminder processing complete. Success: ${results.success}, Failed: ${results.failed}`);

    return new Response(
      JSON.stringify({
        message: "Appointment reminders processed",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-appointment-reminders:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
