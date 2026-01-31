import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { validators, validateSchema, validationErrorResponse } from "../_shared/validation.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

// Input validation schema
const testNotificationSchema = {
  user_id: validators.uuid(),
};

// XSS prevention for email content
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

interface ChannelResult {
  channel: string;
  success: boolean;
  message: string;
  provider?: string;
}

serve(withSentry("send-test-notifications", async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validation = validateSchema(testNotificationSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation, corsHeaders);
    }

    const { user_id } = validation.data;

    console.info("Sending test notifications to user:", user_id);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile for email and phone
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, phone, first_name")
      .eq("user_id", user_id)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
      captureException(profileError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch user profile" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = escapeHtml(profile?.first_name || "there");
    const results: ChannelResult[] = [];

    // Test Email
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && profile?.email) {
      try {
        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">✅ Test Notification</h2>
            <p>Hi ${userName},</p>
            <p>This is a test email from <strong>Pillaxia</strong>.</p>
            <p>If you're seeing this, your email notifications are working correctly!</p>
            <p style="color: #666; font-size: 14px; margin-top: 24px;">— The Pillaxia Care Team</p>
          </div>
        `;

        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Pillaxia <notifications@resend.dev>",
            to: [profile.email],
            subject: "✅ Pillaxia Test Notification",
            html: emailHtml,
          }),
        });

        if (response.ok) {
          results.push({ channel: "email", success: true, message: `Sent to ${profile.email}` });
          console.info("Email test sent successfully");
        } else {
          const errorText = await response.text();
          results.push({ channel: "email", success: false, message: errorText });
          console.error("Email test failed:", errorText);
        }
      } catch (emailError) {
        results.push({ channel: "email", success: false, message: String(emailError) });
        console.error("Email test error:", emailError);
        if (emailError instanceof Error) captureException(emailError);
      }
    } else if (!resendApiKey) {
      results.push({ channel: "email", success: false, message: "Resend API key not configured" });
    } else {
      results.push({ channel: "email", success: false, message: "No email address on profile" });
    }

    // Test SMS
    if (profile?.phone) {
      try {
        const smsMessage = `✅ Pillaxia Test: Hi ${userName}, your SMS notifications are working! — Pillaxia`;

        const { data: smsResult, error: smsError } = await supabase.functions.invoke("send-sms-notification", {
          body: {
            user_id,
            phone_number: profile.phone,
            message: smsMessage,
            notification_type: "test",
            metadata: { test: true },
          },
        });

        if (smsError) throw smsError;

        if (smsResult?.success) {
          results.push({ channel: "sms", success: true, message: `Sent to ${profile.phone}` });
          console.info("SMS test sent successfully");
        } else if (smsResult?.skipped) {
          results.push({ channel: "sms", success: false, message: smsResult?.error || "SMS not configured" });
        } else {
          results.push({ channel: "sms", success: false, message: smsResult?.error || "SMS failed" });
        }
      } catch (smsError) {
        results.push({ channel: "sms", success: false, message: String(smsError) });
        console.error("SMS test error:", smsError);
        if (smsError instanceof Error) captureException(smsError);
      }
    } else {
      results.push({ channel: "sms", success: false, message: "No phone number on profile" });
    }

    // Test WhatsApp (using dual-provider approach)
    if (profile?.phone) {
      try {
        const whatsappMessage = `✅ *Pillaxia Test*\n\nHi ${userName}, your WhatsApp notifications are working!\n\n— Pillaxia`;

        const { data: waResult, error: waError } = await supabase.functions.invoke("send-whatsapp-notification", {
          body: {
            user_id,
            phone_number: profile.phone,
            message: whatsappMessage,
            notification_type: "test",
            metadata: { test: true },
          },
        });

        if (waError) throw waError;

        if (waResult?.success) {
          results.push({ 
            channel: "whatsapp", 
            success: true, 
            message: `Sent to ${profile.phone}`,
            provider: waResult.provider 
          });
          console.info("WhatsApp test sent via", waResult.provider);
        } else if (waResult?.skipped) {
          results.push({ channel: "whatsapp", success: false, message: waResult?.reason || "WhatsApp not configured" });
        } else {
          results.push({ channel: "whatsapp", success: false, message: waResult?.error || "WhatsApp failed" });
        }
      } catch (waError) {
        results.push({ channel: "whatsapp", success: false, message: String(waError) });
        console.error("WhatsApp test error:", waError);
        if (waError instanceof Error) captureException(waError);
      }
    } else {
      results.push({ channel: "whatsapp", success: false, message: "No phone number on profile" });
    }

    // Test Push Notification
    try {
      const { data: pushResult, error: pushError } = await supabase.functions.invoke("send-push-notification", {
        body: {
          user_ids: [user_id],
          payload: {
            title: "✅ Test Notification",
            body: `Hi ${userName}, your push notifications are working!`,
            tag: "test-notification",
            data: { url: "/dashboard/settings" },
          },
        },
      });

      if (pushError) throw pushError;

      if (pushResult?.sent > 0) {
        results.push({ channel: "push", success: true, message: `Sent to ${pushResult.sent} device(s)` });
        console.info("Push test sent to", pushResult.sent, "devices");
      } else {
        results.push({ channel: "push", success: false, message: "No push subscriptions found" });
      }
    } catch (pushError) {
      results.push({ channel: "push", success: false, message: String(pushError) });
      console.error("Push test error:", pushError);
      if (pushError instanceof Error) captureException(pushError);
    }

    const successCount = results.filter(r => r.success).length;
    console.info("Test notifications complete:", successCount, "of", results.length, "succeeded");

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: results.length,
          succeeded: successCount,
          failed: results.length - successCount,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-test-notifications:", error);
    if (error instanceof Error) captureException(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
