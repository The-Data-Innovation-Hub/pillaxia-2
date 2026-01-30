import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RED_FLAG_SEVERITY_THRESHOLD = 8; // Severity 8+ triggers alert

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

serve(withSentry("check-red-flag-symptoms", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.info("Checking for red flag symptoms...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse request body for optional symptom_entry_id
    let symptomEntryId: string | null = null;
    try {
      const body = await req.json();
      symptomEntryId = body.symptom_entry_id || null;
    } catch {
      // No body, check all recent severe symptoms
    }

    // Build query for severe symptoms
    let query = supabase
      .from("symptom_entries")
      .select(`
        id,
        user_id,
        symptom_type,
        severity,
        description,
        recorded_at
      `)
      .gte("severity", RED_FLAG_SEVERITY_THRESHOLD);

    if (symptomEntryId) {
      query = query.eq("id", symptomEntryId);
    } else {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      query = query.gte("recorded_at", oneHourAgo);
    }

    const { data: severeSymptoms, error: symptomsError } = await query;

    if (symptomsError) {
      console.error("Error fetching symptoms:", symptomsError);
      throw symptomsError;
    }

    console.info(`Found ${severeSymptoms?.length || 0} severe symptoms to check`);

    if (!severeSymptoms || severeSymptoms.length === 0) {
      return new Response(
        JSON.stringify({ message: "No severe symptoms found", alerts_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let alertsCreated = 0;

    for (const symptom of severeSymptoms) {
      // Check if alert already exists
      const { data: existingAlert } = await supabase
        .from("red_flag_alerts")
        .select("id")
        .eq("symptom_entry_id", symptom.id)
        .maybeSingle();

      if (existingAlert) {
        console.info(`Alert already exists for symptom ${symptom.id}`);
        continue;
      }

      // Find assigned clinician
      const { data: assignment } = await supabase
        .from("clinician_patient_assignments")
        .select("clinician_user_id")
        .eq("patient_user_id", symptom.user_id)
        .maybeSingle();

      if (!assignment) {
        console.info(`No clinician assigned to patient ${symptom.user_id}`);
        continue;
      }

      // Create red flag alert
      const { error: alertError } = await supabase
        .from("red_flag_alerts")
        .insert({
          patient_user_id: symptom.user_id,
          clinician_user_id: assignment.clinician_user_id,
          symptom_entry_id: symptom.id,
          alert_type: "severe_symptom",
          severity: symptom.severity,
          symptom_type: symptom.symptom_type,
          description: symptom.description,
        });

      if (alertError) {
        console.error("Error creating alert:", alertError);
        continue;
      }

      alertsCreated++;

      // Get patient and clinician info
      const { data: patientProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", symptom.user_id)
        .single();

      const { data: clinicianProfile } = await supabase
        .from("profiles")
        .select("email, first_name")
        .eq("user_id", assignment.clinician_user_id)
        .single();

      if (!clinicianProfile?.email) {
        console.info(`No email for clinician ${assignment.clinician_user_id}`);
        continue;
      }

      const patientName = `${patientProfile?.first_name || ""} ${patientProfile?.last_name || ""}`.trim() || "A patient";

      // Send email alert
      if (RESEND_API_KEY) {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Pillaxia Alerts <alerts@pillaxia.com>",
            to: [clinicianProfile.email],
            subject: `🚨 Red Flag Alert: ${escapeHtml(patientName)} reported severe ${escapeHtml(symptom.symptom_type)}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #dc2626; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
                  <h2 style="margin: 0;">🚨 Red Flag Symptom Alert</h2>
                </div>
                <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
                  <p>Hi ${escapeHtml(clinicianProfile.first_name || "Doctor")},</p>
                  <p><strong>${escapeHtml(patientName)}</strong> has reported a severe symptom that requires your attention:</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Symptom</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(symptom.symptom_type)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Severity</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                        <span style="color: #dc2626; font-weight: bold;">${symptom.severity}/10</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Reported</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${new Date(symptom.recorded_at).toLocaleString()}</td>
                    </tr>
                    ${symptom.description ? `
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Notes</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(symptom.description)}</td>
                    </tr>
                    ` : ""}
                  </table>
                  <p>Please review this patient's condition and take appropriate action.</p>
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                  <p style="color: #6b7280; font-size: 12px;">This is an automated alert from Pillaxia's patient monitoring system.</p>
                </div>
              </div>
            `,
          }),
        });

        if (emailResponse.ok) {
          console.info(`Red flag alert sent to ${clinicianProfile.email}`);
          
          await supabase.from("notification_history").insert({
            user_id: assignment.clinician_user_id,
            channel: "email",
            notification_type: "red_flag_alert",
            title: `Red Flag: ${patientName} - ${symptom.symptom_type}`,
            body: `Severity ${symptom.severity}/10`,
            status: "sent",
            metadata: {
              patient_user_id: symptom.user_id,
              symptom_id: symptom.id,
              symptom_type: symptom.symptom_type,
              severity: symptom.severity,
            },
          });
        } else {
          console.error("Failed to send email:", await emailResponse.text());
        }
      }

      // Send push notification
      await supabase.functions.invoke("send-push-notification", {
        body: {
          user_ids: [assignment.clinician_user_id],
          payload: {
            title: "🚨 Red Flag Alert",
            body: `${patientName}: Severe ${symptom.symptom_type} (${symptom.severity}/10)`,
            tag: "red-flag-alert",
            data: { url: "/dashboard/patients" },
          },
        },
      });
    }

    console.info(`Created ${alertsCreated} new red flag alerts`);

    return new Response(
      JSON.stringify({ message: "Red flag check complete", alerts_created: alertsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-red-flag-symptoms:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
