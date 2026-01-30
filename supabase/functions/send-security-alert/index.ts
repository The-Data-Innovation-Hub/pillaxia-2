import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, withSentry, captureException } from "../_shared/sentry.ts";
import { validators, validateSchema, validationErrorResponse } from "../_shared/validation.ts";

interface SecurityAlertRequest {
  userId: string;
  eventType: string;
  severity: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

const CRITICAL_EVENTS = [
  "account_locked",
  "suspicious_activity",
  "concurrent_session_blocked",
  "login_failure", // Only on multiple failures
];

const EVENT_TITLES: Record<string, string> = {
  account_locked: "🔒 Account Locked",
  account_unlocked: "🔓 Account Unlocked",
  suspicious_activity: "⚠️ Suspicious Activity Detected",
  concurrent_session_blocked: "🚫 Session Blocked",
  login_failure: "❌ Failed Login Attempt",
  password_change: "🔑 Password Changed",
  password_reset_request: "🔄 Password Reset Requested",
  mfa_enabled: "🛡️ Two-Factor Authentication Enabled",
  mfa_disabled: "⚠️ Two-Factor Authentication Disabled",
  data_export: "📤 Data Export Initiated",
  permission_change: "👤 Permissions Changed",
};

// Input validation schema
const securityAlertSchema = {
  userId: validators.uuid(),
  eventType: validators.string({ minLength: 1, maxLength: 100 }),
  severity: validators.enum(["info", "warning", "critical"]),
  description: validators.optional(validators.string({ maxLength: 1000 })),
  metadata: validators.optional(validators.object({})),
};

const handler = withSentry("send-security-alert", async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    const body = await req.json().catch(() => ({}));
    const validation = validateSchema(securityAlertSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation, corsHeaders);
    }

    const { userId, eventType, severity, description, metadata }: SecurityAlertRequest = body;

    console.log(`Processing security alert: ${eventType} for user ${userId}`);

    // Get user email from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile?.email) {
      console.error("Failed to get user profile:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userName = profile.first_name 
      ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ""}`
      : "User";

    const eventTitle = EVENT_TITLES[eventType] || "Security Alert";
    const timestamp = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // Build metadata details - sanitize user input
    let metadataHtml = "";
    if (metadata) {
      const details: string[] = [];
      if (metadata.ip_address && typeof metadata.ip_address === "string") {
        details.push(`<li><strong>IP Address:</strong> ${escapeHtml(metadata.ip_address)}</li>`);
      }
      if (metadata.user_agent && typeof metadata.user_agent === "string") {
        details.push(`<li><strong>Device:</strong> ${escapeHtml(String(metadata.user_agent).substring(0, 100))}...</li>`);
      }
      if (metadata.location && typeof metadata.location === "string") {
        details.push(`<li><strong>Location:</strong> ${escapeHtml(metadata.location)}</li>`);
      }
      if (metadata.url && typeof metadata.url === "string") {
        details.push(`<li><strong>URL:</strong> ${escapeHtml(metadata.url)}</li>`);
      }
      if (details.length > 0) {
        metadataHtml = `<ul style="margin: 0; padding-left: 20px;">${details.join("")}</ul>`;
      }
    }

    const severityColor = severity === "critical" ? "#dc2626" : severity === "warning" ? "#f59e0b" : "#3b82f6";
    const severityBg = severity === "critical" ? "#fef2f2" : severity === "warning" ? "#fffbeb" : "#eff6ff";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: ${severityColor}; padding: 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                        ${escapeHtml(eventTitle)}
                      </h1>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding: 30px;">
                      <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
                        Hello ${escapeHtml(userName)},
                      </p>
                      <p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 20px;">
                        We detected a security event on your Pillaxia account that requires your attention.
                      </p>
                      
                      <!-- Alert Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${severityBg}; border-left: 4px solid ${severityColor}; border-radius: 4px; margin: 20px 0;">
                        <tr>
                          <td style="padding: 16px;">
                            <p style="color: ${severityColor}; font-size: 14px; font-weight: 600; margin: 0 0 8px; text-transform: uppercase;">
                              ${escapeHtml(severity)} Alert
                            </p>
                            <p style="color: #374151; font-size: 15px; margin: 0 0 12px;">
                              ${escapeHtml(description || `A ${eventType.replace(/_/g, " ")} event was detected on your account.`)}
                            </p>
                            <p style="color: #6b7280; font-size: 13px; margin: 0;">
                              <strong>Time:</strong> ${timestamp}
                            </p>
                          </td>
                        </tr>
                      </table>

                      ${metadataHtml ? `
                        <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 20px 0 10px;">
                          Event Details:
                        </p>
                        <div style="background-color: #f9fafb; padding: 12px; border-radius: 4px; font-size: 13px; color: #4b5563;">
                          ${metadataHtml}
                        </div>
                      ` : ""}

                      <!-- Action Items -->
                      <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                        <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 12px;">
                          Recommended Actions:
                        </p>
                        <ul style="color: #4b5563; font-size: 14px; line-height: 22px; margin: 0; padding-left: 20px;">
                          <li>If this was you, no action is needed.</li>
                          <li>If you don't recognize this activity, change your password immediately.</li>
                          <li>Enable two-factor authentication if not already active.</li>
                          <li>Review your recent account activity.</li>
                        </ul>
                      </div>

                      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
                        If you have any concerns about your account security, please contact our support team immediately.
                      </p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                      <p style="color: #6b7280; font-size: 12px; margin: 0;">
                        This is an automated security notification from Pillaxia.
                        <br>
                        You received this email because security notifications are enabled for your account.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "Pillaxia Security <security@thedatainnovationhub.com>",
      to: [profile.email],
      subject: `${eventTitle} - Pillaxia Security Alert`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Failed to send security alert email:", emailError);
      return new Response(
        JSON.stringify({ error: emailError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Security alert email sent successfully:", emailData);

    return new Response(
      JSON.stringify({ success: true, messageId: emailData?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-security-alert:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to escape HTML for XSS prevention
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

serve(handler);
