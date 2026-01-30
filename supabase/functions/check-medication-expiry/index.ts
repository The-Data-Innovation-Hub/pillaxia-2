import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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

async function sendEmail(to: string[], subject: string, html: string): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Pillaxia Pharmacy <noreply@thedatainnovationhub.com>",
      to,
      subject,
      html,
    }),
  });
  
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Resend API error: ${error}`);
  }
  
  const data = await res.json();
  return { id: data.id };
}

interface ExpiringDrug {
  id: string;
  name: string;
  strength: string;
  form: string;
  expiry_date: string;
  current_stock: number;
  lot_number: string | null;
  expiry_alert_sent: boolean;
}

interface ExpiryAlert {
  drug_id: string;
  name: string;
  strength: string;
  form: string;
  expiry_date: string;
  days_until_expiry: number;
  severity: "critical" | "warning" | "expired";
  current_stock: number;
  lot_number: string | null;
}

serve(withSentry("check-medication-expiry", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.info("Checking medication expiry dates...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get all controlled drugs with expiry dates
    const { data: expiringDrugs, error: fetchError } = await supabase
      .from("controlled_drugs")
      .select("id, name, strength, form, expiry_date, current_stock, lot_number, expiry_alert_sent")
      .eq("is_active", true)
      .not("expiry_date", "is", null)
      .lte("expiry_date", thirtyDaysFromNow.toISOString().split("T")[0])
      .order("expiry_date", { ascending: true });

    if (fetchError) {
      console.error("Error fetching expiring drugs:", fetchError);
      throw fetchError;
    }

    console.info(`Found ${expiringDrugs?.length || 0} medications expiring within 30 days`);

    const alerts: ExpiryAlert[] = [];
    const newAlerts: ExpiryAlert[] = [];

    for (const drug of (expiringDrugs as ExpiringDrug[]) || []) {
      const expiryDate = new Date(drug.expiry_date);
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let severity: "critical" | "warning" | "expired";
      if (daysUntilExpiry <= 0) {
        severity = "expired";
      } else if (daysUntilExpiry <= 7) {
        severity = "critical";
      } else {
        severity = "warning";
      }

      const alert: ExpiryAlert = {
        drug_id: drug.id,
        name: drug.name,
        strength: drug.strength,
        form: drug.form,
        expiry_date: drug.expiry_date,
        days_until_expiry: daysUntilExpiry,
        severity,
        current_stock: drug.current_stock,
        lot_number: drug.lot_number,
      };

      alerts.push(alert);

      if (!drug.expiry_alert_sent && (severity === "critical" || severity === "expired")) {
        newAlerts.push(alert);
      }
    }

    // Get all pharmacist users to notify
    const { data: pharmacistRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "pharmacist");

    if (rolesError) {
      console.error("Error fetching pharmacists:", rolesError);
    }

    const pharmacistIds = pharmacistRoles?.map(r => r.user_id) || [];
    console.info(`Found ${pharmacistIds.length} pharmacist(s) to notify`);

    // Send notifications if there are new critical/expired alerts
    if (newAlerts.length > 0 && pharmacistIds.length > 0) {
      const { data: pharmacistProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email, first_name")
        .in("user_id", pharmacistIds);

      if (profilesError) {
        console.error("Error fetching pharmacist profiles:", profilesError);
      }

      const expiredList = newAlerts.filter(a => a.severity === "expired");
      const criticalList = newAlerts.filter(a => a.severity === "critical");

      const buildDrugRow = (alert: ExpiryAlert) => `
        <tr style="background-color: ${alert.severity === 'expired' ? '#fef2f2' : '#fffbeb'};">
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <strong>${escapeHtml(alert.name)}</strong><br/>
            <span style="color: #6b7280; font-size: 14px;">
              ${escapeHtml(alert.strength)} • ${escapeHtml(alert.form)}
              ${alert.lot_number ? ` • Lot: ${escapeHtml(alert.lot_number)}` : ''}
            </span>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
            ${alert.current_stock} units
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <span style="color: ${alert.severity === 'expired' ? '#dc2626' : '#d97706'}; font-weight: 600;">
              ${alert.severity === 'expired' ? 'EXPIRED' : `${alert.days_until_expiry} days left`}
            </span><br/>
            <span style="font-size: 12px; color: #6b7280;">${alert.expiry_date}</span>
          </td>
        </tr>
      `;

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
                <h1 style="color: #dc2626; font-size: 24px; margin: 0;">⚠️ Medication Expiry Alert</h1>
              </div>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.5;">
                The following controlled substances require immediate attention:
              </p>

              ${expiredList.length > 0 ? `
                <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <h3 style="color: #dc2626; margin: 0 0 8px 0;">🚨 Expired Medications (${expiredList.length})</h3>
                  <p style="color: #7f1d1d; font-size: 14px; margin: 0;">
                    These medications have expired and should be removed from inventory immediately.
                  </p>
                </div>
              ` : ''}

              ${criticalList.length > 0 ? `
                <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <h3 style="color: #d97706; margin: 0 0 8px 0;">⚡ Expiring Soon (${criticalList.length})</h3>
                  <p style="color: #92400e; font-size: 14px; margin: 0;">
                    These medications will expire within 7 days.
                  </p>
                </div>
              ` : ''}

              <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Medication</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151;">Stock</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151;">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  ${newAlerts.map(buildDrugRow).join('')}
                </tbody>
              </table>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin-top: 24px;">
                Please review the Controlled Drug Register in Pillaxia to take appropriate action.
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />

              <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                This alert was sent by Pillaxia Pharmacy Management System.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      for (const pharmacist of pharmacistProfiles || []) {
        if (!pharmacist.email) continue;

        try {
          const emailResult = await sendEmail(
            [pharmacist.email],
            `⚠️ Medication Expiry Alert: ${newAlerts.length} item(s) require attention`,
            emailHtml
          );

          console.info(`Expiry alert email sent to ${pharmacist.email}:`, emailResult.id);

          await supabase.from("notification_history").insert({
            user_id: pharmacist.user_id,
            channel: "email",
            notification_type: "medication_expiry",
            title: `Medication Expiry Alert: ${newAlerts.length} item(s)`,
            body: `${expiredList.length} expired, ${criticalList.length} expiring soon`,
            status: "sent",
            metadata: { 
              resend_email_id: emailResult.id,
              expired_count: expiredList.length,
              critical_count: criticalList.length,
            },
          });
        } catch (emailError) {
          console.error(`Failed to send email to ${pharmacist.email}:`, emailError);
          
          await supabase.from("notification_history").insert({
            user_id: pharmacist.user_id,
            channel: "email",
            notification_type: "medication_expiry",
            title: `Medication Expiry Alert: ${newAlerts.length} item(s)`,
            body: `${expiredList.length} expired, ${criticalList.length} expiring soon`,
            status: "failed",
            error_message: String(emailError).slice(0, 500),
          });
        }
      }

      // Send push notifications
      if (pharmacistIds.length > 0) {
        try {
          await supabase.functions.invoke("send-push-notification", {
            body: {
              user_ids: pharmacistIds,
              payload: {
                title: "⚠️ Medication Expiry Alert",
                body: `${expiredList.length} expired, ${criticalList.length} expiring soon. Immediate action required.`,
                tag: "medication-expiry",
                requireInteraction: true,
                data: { url: "/dashboard/controlled-drugs" },
              },
            },
          });
          console.info("Push notifications sent to pharmacists");
        } catch (pushError) {
          console.error("Error sending push notifications:", pushError);
        }
      }

      // Mark alerts as sent
      const alertDrugIds = newAlerts.map(a => a.drug_id);
      await supabase
        .from("controlled_drugs")
        .update({ expiry_alert_sent: true })
        .in("id", alertDrugIds);
      
      console.info(`Marked ${alertDrugIds.length} drugs as alert sent`);
    }

    const summary = {
      expired: alerts.filter(a => a.severity === "expired").length,
      critical: alerts.filter(a => a.severity === "critical").length,
      warning: alerts.filter(a => a.severity === "warning").length,
      total: alerts.length,
      newAlertsSent: newAlerts.length,
      pharmacistsNotified: pharmacistIds.length,
    };

    console.info("Expiry check summary:", summary);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary,
        alerts,
        message: `Found ${summary.total} medications with expiry concerns, sent ${summary.newAlertsSent} new alerts`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error checking medication expiry:", error);
    captureException(error instanceof Error ? error : new Error(errorMessage));
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
