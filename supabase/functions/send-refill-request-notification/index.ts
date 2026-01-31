import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RefillNotificationRequest {
  patient_user_id: string;
  medication_name: string;
  status: "approved" | "denied";
  refills_granted?: number;
  pharmacist_notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patient_user_id, medication_name, status, refills_granted, pharmacist_notes }: RefillNotificationRequest = await req.json();

    console.info(`Processing refill notification for patient ${patient_user_id}, medication: ${medication_name}, status: ${status}`);

    if (!patient_user_id || !medication_name || !status) {
      throw new Error("Missing required fields: patient_user_id, medication_name, status");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get patient profile and preferences
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name, phone")
      .eq("user_id", patient_user_id)
      .single();

    if (profileError || !profile) {
      console.error("Failed to fetch patient profile:", profileError);
      throw new Error("Patient profile not found");
    }

    // Check notification preferences
    const { data: prefs } = await supabase
      .from("patient_notification_preferences")
      .select("email_reminders, push_clinician_messages, sms_reminders, whatsapp_reminders")
      .eq("user_id", patient_user_id)
      .single();

    const emailEnabled = prefs?.email_reminders !== false;
    const pushEnabled = prefs?.push_clinician_messages !== false;
    const smsEnabled = prefs?.sms_reminders !== false;
    const whatsappEnabled = prefs?.whatsapp_reminders !== false;

    const patientName = profile.first_name || "Patient";
    const isApproved = status === "approved";

    // Build notification content
    const title = isApproved 
      ? `Refill Request Approved! ✅` 
      : `Refill Request Update`;
    
    let body = isApproved
      ? `Great news! Your refill request for ${medication_name} has been approved.`
      : `Your refill request for ${medication_name} has been reviewed.`;

    if (isApproved && refills_granted) {
      body += ` You have been granted ${refills_granted} refill${refills_granted > 1 ? 's' : ''}.`;
    }

    if (!isApproved && pharmacist_notes) {
      body += ` Note from pharmacist: ${pharmacist_notes}`;
    }

    const results = { email: null as any, push: null as any, sms: null as any, whatsapp: null as any };

    // Send email notification
    if (emailEnabled && profile.email) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 64px; height: 64px; background: ${isApproved ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'}; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-size: 32px;">${isApproved ? '✓' : '✕'}</span>
                    </div>
                    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 600; margin: 0;">
                      ${isApproved ? 'Refill Request Approved!' : 'Refill Request Denied'}
                    </h1>
                  </div>
                  
                  <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 16px;">
                    Hi ${patientName},
                  </p>
                  
                  <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                    ${isApproved 
                      ? `Your refill request for <strong>${medication_name}</strong> has been approved by your pharmacist.`
                      : `Your refill request for <strong>${medication_name}</strong> has been reviewed by your pharmacist.`
                    }
                  </p>
                  
                  ${isApproved && refills_granted ? `
                  <div style="background-color: #f0fdf4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="color: #166534; font-size: 14px; margin: 0;">
                      <strong>Refills Granted:</strong> ${refills_granted}
                    </p>
                  </div>
                  ` : ''}
                  
                  ${!isApproved && pharmacist_notes ? `
                  <div style="background-color: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="color: #991b1b; font-size: 14px; margin: 0;">
                      <strong>Pharmacist's Note:</strong> ${pharmacist_notes}
                    </p>
                  </div>
                  ` : ''}
                  
                  ${isApproved ? `
                  <div style="text-align: center; margin-top: 24px;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                      Your prescription is being prepared. You'll receive another notification when it's ready for pickup.
                    </p>
                  </div>
                  ` : `
                  <div style="text-align: center; margin-top: 24px;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                      If you have questions about this decision, please contact your pharmacy or healthcare provider.
                    </p>
                  </div>
                  `}
                </div>
                
                <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 24px;">
                  This is an automated message from Pillaxia. Please do not reply to this email.
                </p>
              </div>
            </body>
            </html>
          `;

          const emailResponse = await resend.emails.send({
            from: "Pillaxia <notifications@resend.dev>",
            to: [profile.email],
            subject: title,
            html: emailHtml,
          });

          results.email = { success: true, id: emailResponse.data?.id };
          console.info("Email sent successfully:", emailResponse.data?.id);
        }
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        results.email = { success: false, error: String(emailError) };
      }
    }

    // Send push notification
    if (pushEnabled) {
      try {
        const pushResponse = await supabase.functions.invoke("send-push-notification", {
          body: {
            user_id: patient_user_id,
            title,
            body,
            data: { type: "refill_request", medication_name, status },
          },
        });

        results.push = { success: !pushResponse.error, data: pushResponse.data };
        console.info("Push notification result:", pushResponse);
      } catch (pushError) {
        console.error("Failed to send push notification:", pushError);
        results.push = { success: false, error: String(pushError) };
      }
    }

    // Send SMS notification
    if (smsEnabled && profile.phone) {
      try {
        // Build concise SMS message
        let smsBody = isApproved
          ? `Pillaxia: Your refill for ${medication_name} is approved!`
          : `Pillaxia: Your refill for ${medication_name} was denied.`;
        
        if (isApproved && refills_granted) {
          smsBody += ` ${refills_granted} refill${refills_granted > 1 ? 's' : ''} granted.`;
        }
        
        if (!isApproved && pharmacist_notes) {
          // Truncate notes for SMS
          const truncatedNotes = pharmacist_notes.length > 80 
            ? pharmacist_notes.substring(0, 77) + "..." 
            : pharmacist_notes;
          smsBody += ` Note: ${truncatedNotes}`;
        }

        const smsResponse = await supabase.functions.invoke("send-sms-notification", {
          body: {
            to: profile.phone,
            message: smsBody,
          },
        });

        results.sms = { success: !smsResponse.error, data: smsResponse.data };
        console.info("SMS notification result:", smsResponse);

        // Log SMS to notification history
        await supabase.from("notification_history").insert({
          user_id: patient_user_id,
          notification_type: "refill_request",
          channel: "sms",
          title: isApproved ? "Refill Approved" : "Refill Denied",
          body: smsBody,
          status: results.sms?.success ? "delivered" : "failed",
          metadata: { medication_name, refill_status: status, refills_granted, phone: profile.phone },
        });
      } catch (smsError) {
        console.error("Failed to send SMS notification:", smsError);
        results.sms = { success: false, error: String(smsError) };
      }
    }

    // Send WhatsApp notification
    if (whatsappEnabled && profile.phone) {
      try {
        // Build WhatsApp message
        let whatsappBody = isApproved
          ? `💊 Pillaxia: Great news! Your refill request for ${medication_name} has been approved.`
          : `💊 Pillaxia: Your refill request for ${medication_name} has been reviewed.`;
        
        if (isApproved && refills_granted) {
          whatsappBody += ` You have ${refills_granted} refill${refills_granted > 1 ? 's' : ''} available.`;
        }
        
        if (!isApproved && pharmacist_notes) {
          const truncatedNotes = pharmacist_notes.length > 100 
            ? pharmacist_notes.substring(0, 97) + "..." 
            : pharmacist_notes;
          whatsappBody += ` Pharmacist note: ${truncatedNotes}`;
        }

        const whatsappResponse = await supabase.functions.invoke("send-whatsapp-notification", {
          body: {
            recipientId: patient_user_id,
            senderName: "Pillaxia Pharmacy",
            message: whatsappBody,
            notificationType: "medication_reminder",
          },
        });

        results.whatsapp = { success: !whatsappResponse.error, data: whatsappResponse.data };
        console.info("WhatsApp notification result:", whatsappResponse);

        // Log WhatsApp to notification history
        await supabase.from("notification_history").insert({
          user_id: patient_user_id,
          notification_type: "refill_request",
          channel: "whatsapp",
          title: isApproved ? "Refill Approved" : "Refill Denied",
          body: whatsappBody,
          status: results.whatsapp?.success ? "delivered" : "failed",
          metadata: { medication_name, refill_status: status, refills_granted, phone: profile.phone },
        });
      } catch (whatsappError) {
        console.error("Failed to send WhatsApp notification:", whatsappError);
        results.whatsapp = { success: false, error: String(whatsappError) };
      }
    }

    // Log to notification history
    try {
      await supabase.from("notification_history").insert({
        user_id: patient_user_id,
        notification_type: "refill_request",
        channel: "email",
        title,
        body,
        status: results.email?.success ? "delivered" : "failed",
        metadata: { medication_name, refill_status: status, refills_granted },
      });
    } catch (logError) {
      console.error("Failed to log notification:", logError);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-refill-request-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
