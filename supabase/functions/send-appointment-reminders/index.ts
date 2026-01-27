import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendSMS(
  phone: string,
  message: string,
  twilioAccountSid: string,
  twilioAuthToken: string,
  twilioPhoneNumber: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
    
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const twilioBody = new URLSearchParams({
      To: formattedPhone,
      From: twilioPhoneNumber,
      Body: message,
    });

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: twilioBody,
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.message || "Twilio API error" };
    }

    return { success: true, sid: result.sid };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Send WhatsApp via Twilio
async function sendWhatsAppViaTwilio(
  phone: string,
  message: string,
  twilioAccountSid: string,
  twilioAuthToken: string,
  twilioPhoneNumber: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const formattedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
    const fromWhatsApp = `whatsapp:${twilioPhoneNumber}`;
    const toWhatsApp = `whatsapp:${formattedPhone}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const twilioBody = new URLSearchParams({
      To: toWhatsApp,
      From: fromWhatsApp,
      Body: message,
    });

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: twilioBody,
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.message || "Twilio WhatsApp API error" };
    }

    return { success: true, sid: result.sid };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Send WhatsApp via Meta Graph API (fallback)
async function sendWhatsAppViaMeta(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const whatsappToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

  if (!whatsappToken || !whatsappPhoneId) {
    return { success: false, error: "meta_not_configured" };
  }

  try {
    const formattedPhone = phone.replace(/\D/g, "");

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "text",
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: JSON.stringify(errorData) };
    }

    const result = await response.json();
    return { success: true, messageId: result.messages?.[0]?.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    const twilioConfigured = twilioAccountSid && twilioAuthToken && twilioPhoneNumber;

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

    const results = { emailSent: 0, smsSent: 0, whatsappSent: 0, failed: 0 };

    for (const appointment of appointments) {
      try {
        // Get patient profile
        const { data: patientProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email, phone")
          .eq("user_id", appointment.patient_user_id)
          .single();

        // Get clinician profile
        const { data: clinicianProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("user_id", appointment.clinician_user_id)
          .single();

        // Check patient notification preferences
        const { data: prefs } = await supabase
          .from("patient_notification_preferences")
          .select("email_reminders, sms_reminders, whatsapp_reminders")
          .eq("user_id", appointment.patient_user_id)
          .single();

        const appointmentTime = appointment.appointment_time.slice(0, 5);
        const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        let emailSent = false;
        let smsSent = false;
        let whatsappSent = false;
        if (resendApiKey && patientProfile?.email && (prefs?.email_reminders !== false)) {
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

          if (emailResponse.ok) {
            emailSent = true;
            results.emailSent++;
            console.log(`Email reminder sent to ${patientProfile.email}`);

            // Log email notification
            await supabase.from("notification_history").insert({
              user_id: appointment.patient_user_id,
              channel: "email",
              notification_type: "appointment_reminder",
              title: `Appointment Reminder: ${appointment.title}`,
              body: `Your appointment is scheduled for tomorrow at ${appointmentTime}`,
              status: "sent",
              metadata: { appointment_id: appointment.id },
            });
          } else {
            const errorText = await emailResponse.text();
            console.error(`Failed to send email reminder: ${errorText}`);
          }
        }

        // Send SMS reminder if enabled and phone available
        if (twilioConfigured && patientProfile?.phone && (prefs?.sms_reminders !== false)) {
          const smsMessage = `Pillaxia Reminder: Your appointment "${appointment.title}" is tomorrow at ${appointmentTime}${appointment.location ? ` at ${appointment.location}` : ""}${clinicianProfile ? ` with Dr. ${clinicianProfile.last_name}` : ""}. Reply STOP to opt out.`;

          const smsResult = await sendSMS(
            patientProfile.phone,
            smsMessage,
            twilioAccountSid!,
            twilioAuthToken!,
            twilioPhoneNumber!
          );

          if (smsResult.success) {
            smsSent = true;
            results.smsSent++;
            console.log(`SMS reminder sent to ${patientProfile.phone}`);

            // Log SMS notification
            await supabase.from("notification_history").insert({
              user_id: appointment.patient_user_id,
              channel: "sms",
              notification_type: "appointment_reminder",
              title: `Appointment Reminder: ${appointment.title}`,
              body: smsMessage,
              status: "sent",
              metadata: { appointment_id: appointment.id, twilio_sid: smsResult.sid },
            });
          } else {
            console.error(`Failed to send SMS reminder: ${smsResult.error}`);
          }
        }

        // Send WhatsApp reminder if enabled and phone available
        if (patientProfile?.phone && (prefs?.whatsapp_reminders !== false)) {
          const whatsappMessage = `📅 Pillaxia Appointment Reminder\n\nHello ${patientProfile.first_name || "there"},\n\nYour appointment "${appointment.title}" is scheduled for tomorrow at ${appointmentTime}${appointment.location ? ` at ${appointment.location}` : ""}${clinicianProfile ? ` with Dr. ${clinicianProfile.last_name}` : ""}.\n\nPlease arrive on time. Log in to your Pillaxia account to reschedule if needed.`;

          let whatsappResult: { success: boolean; sid?: string; messageId?: string; error?: string };
          let provider = "twilio";

          // Try Twilio first if configured
          if (twilioConfigured) {
            whatsappResult = await sendWhatsAppViaTwilio(
              patientProfile.phone,
              whatsappMessage,
              twilioAccountSid!,
              twilioAuthToken!,
              twilioPhoneNumber!
            );
          } else {
            // Fall back to Meta Graph API
            provider = "meta";
            whatsappResult = await sendWhatsAppViaMeta(patientProfile.phone, whatsappMessage);
          }

          // If Twilio failed, try Meta as fallback
          if (!whatsappResult.success && twilioConfigured) {
            provider = "meta";
            whatsappResult = await sendWhatsAppViaMeta(patientProfile.phone, whatsappMessage);
          }

          if (whatsappResult.success) {
            whatsappSent = true;
            results.whatsappSent++;
            console.log(`WhatsApp reminder sent to ${patientProfile.phone} via ${provider}`);

            // Log WhatsApp notification
            await supabase.from("notification_history").insert({
              user_id: appointment.patient_user_id,
              channel: "whatsapp",
              notification_type: "appointment_reminder",
              title: `Appointment Reminder: ${appointment.title}`,
              body: whatsappMessage.substring(0, 200),
              status: "sent",
              metadata: { 
                appointment_id: appointment.id, 
                provider,
                message_id: whatsappResult.sid || whatsappResult.messageId 
              },
            });
          } else if (whatsappResult.error !== "meta_not_configured") {
            console.error(`Failed to send WhatsApp reminder: ${whatsappResult.error}`);
          }
        }

        // Mark reminder as sent if at least one channel succeeded
        if (emailSent || smsSent || whatsappSent) {
          const { error: updateError } = await supabase
            .from("appointments")
            .update({ reminder_sent: true })
            .eq("id", appointment.id);

          if (updateError) {
            console.error(`Failed to update reminder_sent: ${updateError.message}`);
          }
        } else {
          results.failed++;
        }
      } catch (appointmentError) {
        console.error(`Error processing appointment ${appointment.id}:`, appointmentError);
        results.failed++;
      }
    }

    console.log(`Reminder processing complete. Email: ${results.emailSent}, SMS: ${results.smsSent}, WhatsApp: ${results.whatsappSent}, Failed: ${results.failed}`);

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
