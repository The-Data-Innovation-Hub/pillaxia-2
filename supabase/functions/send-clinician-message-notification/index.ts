import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  recipientId: string;
  senderName: string;
  message: string;
  senderType: "clinician" | "patient";
  messageId?: string; // Optional: to update delivery status on the message
}

interface DeliveryStatus {
  sent: boolean;
  at?: string;
  error?: string;
}

interface DeliveryStatusMap {
  email?: DeliveryStatus;
  push?: DeliveryStatus;
  whatsapp?: DeliveryStatus;
  sms?: DeliveryStatus;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientId, senderName, message, senderType, messageId }: NotificationRequest = await req.json();

    if (!recipientId || !senderName || !message || !senderType) {
      throw new Error("Missing required fields: recipientId, senderName, message, senderType");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get recipient's profile and notification preferences
    const [profileResult, prefsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, first_name, phone")
        .eq("user_id", recipientId)
        .maybeSingle(),
      supabase
        .from("patient_notification_preferences")
        .select("email_clinician_messages, push_clinician_messages, whatsapp_clinician_messages, sms_reminders")
        .eq("user_id", recipientId)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      console.error("Error fetching profile:", profileResult.error);
      throw profileResult.error;
    }

    const profile = profileResult.data;
    const prefs = prefsResult.data;

    // Default preferences if not set (all enabled)
    const emailEnabled = prefs?.email_clinician_messages ?? true;
    const pushEnabled = prefs?.push_clinician_messages ?? true;
    const whatsappEnabled = prefs?.whatsapp_clinician_messages ?? true;
    const smsEnabled = prefs?.sms_reminders ?? true; // Use sms_reminders as general SMS toggle

    const recipientName = profile?.first_name || "there";
    const deliveryStatus: DeliveryStatusMap = {};
    const now = new Date().toISOString();

    // 1. Send Email if enabled and email exists
    if (emailEnabled && profile?.email) {
      try {
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (resendKey) {
          const resend = new Resend(resendKey);
          const subjectPrefix = senderType === "clinician" ? "🩺" : "💬";
          const senderLabel = senderType === "clinician" ? "your healthcare provider" : "your patient";
          
          const emailResponse = await resend.emails.send({
            from: "Pillaxia <noreply@resend.dev>",
            to: [profile.email],
            subject: `${subjectPrefix} New message from ${senderName}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">${subjectPrefix} New Message</h1>
                </div>
                
                <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e5e7eb; border-top: none;">
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    Hi ${recipientName}! 👋
                  </p>
                  
                  <p style="font-size: 16px; margin-bottom: 20px;">
                    You have a new message from ${senderLabel}, <strong>${senderName}</strong>:
                  </p>
                  
                  <div style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid #0EA5E9; margin: 20px 0;">
                    <p style="font-size: 16px; margin: 0; color: #4b5563;">
                      "${message.substring(0, 500)}${message.length > 500 ? "..." : ""}"
                    </p>
                  </div>
                  
                  <p style="font-size: 16px; margin-top: 20px;">
                    Log in to Pillaxia to view and reply to this message.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                  
                  <p style="font-size: 14px; color: #6b7280; text-align: center;">
                    This message was sent through Pillaxia.<br>
                    Stay healthy, stay connected.
                  </p>
                </div>
              </body>
              </html>
            `,
          });

          if (emailResponse.error) {
            console.error("Email send error:", emailResponse.error);
            deliveryStatus.email = { sent: false, at: now, error: emailResponse.error.message };
            
            await supabase.from("notification_history").insert({
              user_id: recipientId,
              channel: "email",
              notification_type: "clinician_message",
              title: `Message from ${senderName}`,
              body: message.substring(0, 200),
              status: "failed",
              error_message: emailResponse.error.message?.slice(0, 500),
              metadata: { sender_name: senderName, sender_type: senderType, message_id: messageId },
            });
          } else {
            console.log(`Email sent to ${profile.email}, ID: ${emailResponse.data?.id}`);
            deliveryStatus.email = { sent: true, at: now };
            
            await supabase.from("notification_history").insert({
              user_id: recipientId,
              channel: "email",
              notification_type: "clinician_message",
              title: `Message from ${senderName}`,
              body: message.substring(0, 200),
              status: "sent",
              metadata: { 
                sender_name: senderName, 
                sender_type: senderType,
                recipient_email: profile.email,
                resend_email_id: emailResponse.data?.id,
                message_id: messageId,
              },
            });
          }
        } else {
          deliveryStatus.email = { sent: false, at: now, error: "RESEND_API_KEY not configured" };
        }
      } catch (emailErr: any) {
        console.error("Email error:", emailErr);
        deliveryStatus.email = { sent: false, at: now, error: emailErr.message };
      }
    } else {
      deliveryStatus.email = { sent: false, at: now, error: emailEnabled ? "No email address" : "Disabled by user" };
    }

    // 2. Send Push Notification if enabled
    if (pushEnabled) {
      try {
        const pushTitle = senderType === "clinician" 
          ? `🩺 Message from ${senderName}`
          : `💬 Message from ${senderName}`;
        
        const { data: pushData, error: pushError } = await supabase.functions.invoke("send-push-notification", {
          body: {
            user_ids: [recipientId],
            payload: {
              title: pushTitle,
              body: message.substring(0, 150) + (message.length > 150 ? "..." : ""),
              tag: `clinician-msg-${recipientId}`,
              data: { url: "/dashboard" },
            },
          },
        });

        if (pushError) {
          console.error("Push notification error:", pushError);
          deliveryStatus.push = { sent: false, at: now, error: pushError.message };
        } else if (pushData?.sent === 0) {
          deliveryStatus.push = { sent: false, at: now, error: "No active push subscription" };
        } else {
          console.log(`Push sent to ${pushData?.sent} device(s)`);
          deliveryStatus.push = { sent: true, at: now };
        }
      } catch (pushErr: any) {
        console.error("Push error:", pushErr);
        deliveryStatus.push = { sent: false, at: now, error: pushErr.message };
      }
    } else {
      deliveryStatus.push = { sent: false, at: now, error: "Disabled by user" };
    }

    // 3. Send WhatsApp if enabled and phone exists
    if (whatsappEnabled && profile?.phone) {
      try {
        const { data: waData, error: waError } = await supabase.functions.invoke("send-whatsapp-notification", {
          body: {
            recipientId,
            senderName,
            message,
            notificationType: "clinician_message",
          },
        });

        if (waError) {
          console.error("WhatsApp error:", waError);
          deliveryStatus.whatsapp = { sent: false, at: now, error: waError.message };
        } else if (!waData?.success) {
          deliveryStatus.whatsapp = { sent: false, at: now, error: waData?.reason || waData?.message };
        } else {
          console.log("WhatsApp sent successfully");
          deliveryStatus.whatsapp = { sent: true, at: now };
        }
      } catch (waErr: any) {
        console.error("WhatsApp exception:", waErr);
        deliveryStatus.whatsapp = { sent: false, at: now, error: waErr.message };
      }
    } else {
      deliveryStatus.whatsapp = { sent: false, at: now, error: whatsappEnabled ? "No phone number" : "Disabled by user" };
    }

    // 4. Send SMS if enabled and phone exists
    if (smsEnabled && profile?.phone) {
      try {
        const smsMessage = senderType === "clinician"
          ? `New message from your healthcare provider ${senderName}: "${message.substring(0, 100)}${message.length > 100 ? "..." : ""}" — Pillaxia`
          : `New message from your patient ${senderName}: "${message.substring(0, 100)}${message.length > 100 ? "..." : ""}" — Pillaxia`;

        const { data: smsData, error: smsError } = await supabase.functions.invoke("send-sms-notification", {
          body: {
            user_id: recipientId,
            phone_number: profile.phone,
            message: smsMessage,
            notification_type: "clinician_message",
            metadata: { sender_name: senderName, sender_type: senderType, message_id: messageId },
          },
        });

        if (smsError) {
          console.error("SMS error:", smsError);
          deliveryStatus.sms = { sent: false, at: now, error: smsError.message };
        } else if (smsData?.skipped) {
          deliveryStatus.sms = { sent: false, at: now, error: smsData.error || "SMS not configured" };
        } else if (smsData?.error) {
          deliveryStatus.sms = { sent: false, at: now, error: smsData.error };
        } else {
          console.log("SMS sent successfully:", smsData?.sid);
          deliveryStatus.sms = { sent: true, at: now };
        }
      } catch (smsErr: any) {
        console.error("SMS exception:", smsErr);
        deliveryStatus.sms = { sent: false, at: now, error: smsErr.message };
      }
    } else {
      deliveryStatus.sms = { sent: false, at: now, error: smsEnabled ? "No phone number" : "Disabled by user" };
    }

    // Update the message with delivery status if messageId provided
    if (messageId) {
      const { error: updateError } = await supabase
        .from("clinician_messages")
        .update({ delivery_status: deliveryStatus })
        .eq("id", messageId);

      if (updateError) {
        console.error("Failed to update delivery status:", updateError);
      } else {
        console.log("Delivery status updated for message:", messageId);
      }
    }

    console.log("Notification results:", deliveryStatus);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deliveryStatus,
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  } catch (error: any) {
    console.error("Error in send-clinician-message-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
});
