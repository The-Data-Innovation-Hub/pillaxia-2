import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validators, validateSchema } from "../_shared/validation.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Input validation schema - supports single user or batch
const engagementScoreSchema = {
  userId: validators.optional(validators.uuid()),
  days: validators.optional(validators.number({ min: 1, max: 90, integer: true })),
};

interface EngagementMetrics {
  adherence: {
    taken: number;
    missed: number;
    total: number;
    rate: number;
  };
  appUsage: {
    logins: number;
    pageViews: number;
    actionsPerformed: number;
  };
  notifications: {
    sent: number;
    opened: number;
    clicked: number;
    openRate: number;
    clickRate: number;
  };
}

serve(withSentry("calculate-engagement-scores", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Create authenticated client for user verification
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized - missing or invalid authorization header" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  // Validate JWT and get caller identity
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  
  if (claimsError || !claimsData?.claims?.sub) {
    console.error("[ENGAGEMENT] JWT validation failed:", claimsError);
    return new Response(
      JSON.stringify({ error: "Unauthorized - invalid token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const callerId = claimsData.claims.sub as string;
  console.info(`[ENGAGEMENT] Request from user: ${callerId}`);

  // Service role client for privileged operations
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Parse and validate input
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const validation = validateSchema(engagementScoreSchema, body);
  const userId = validation.success ? validation.data.userId : undefined;
  const days = (validation.success ? validation.data.days : undefined) ?? 7;
  
  // Check if caller is admin
  const { data: isAdminResult } = await supabase.rpc("is_admin", { _user_id: callerId });
  const callerIsAdmin = isAdminResult === true;

  // Authorization check for specific patient access
  if (userId) {
    if (!callerIsAdmin) {
      // Check if caller is an assigned clinician for this patient
      const { data: assignment } = await supabase
        .from("clinician_patient_assignments")
        .select("id")
        .eq("patient_user_id", userId)
        .eq("clinician_user_id", callerId)
        .maybeSingle();
      
      if (!assignment) {
        console.warn(`[ENGAGEMENT] Unauthorized access attempt: ${callerId} tried to access patient ${userId}`);
        return new Response(
          JSON.stringify({ error: "Not authorized to access this patient's data" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    console.info(`[ENGAGEMENT] Authorized access to patient ${userId} by ${callerIsAdmin ? "admin" : "clinician"} ${callerId}`);
  } else {
    // Batch processing - admin only
    if (!callerIsAdmin) {
      console.warn(`[ENGAGEMENT] Batch processing denied for non-admin: ${callerId}`);
      return new Response(
        JSON.stringify({ error: "Batch processing requires admin privileges" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.info(`[ENGAGEMENT] Admin ${callerId} initiating batch engagement score calculation`);
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString();

  // Get all patients or specific patient
  let patientQuery = supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "patient");

  if (userId) {
    patientQuery = patientQuery.eq("user_id", userId);
  }

  const { data: patients, error: patientsError } = await patientQuery;

  if (patientsError) {
    const err = new Error(String(patientsError));
    captureException(err);
    throw err;
  }

  console.info(`Processing engagement scores for ${patients?.length || 0} patients`);

    const results = [];

    for (const patient of patients || []) {
      const patientId = patient.user_id;

      // 1. Calculate adherence score (last N days)
      const { data: medLogs } = await supabase
        .from("medication_logs")
        .select("status")
        .eq("user_id", patientId)
        .gte("scheduled_time", startDateStr);

      const takenCount = medLogs?.filter((l) => l.status === "taken").length || 0;
      const missedCount = medLogs?.filter((l) => l.status === "missed").length || 0;
      const totalLogs = medLogs?.length || 0;
      const adherenceRate = totalLogs > 0 ? (takenCount / totalLogs) * 100 : 100;

      // 2. Calculate app usage score (activity log)
      const { data: activities } = await supabase
        .from("patient_activity_log")
        .select("activity_type")
        .eq("user_id", patientId)
        .gte("created_at", startDateStr);

      const logins = activities?.filter((a) => a.activity_type === "login").length || 0;
      const pageViews = activities?.filter((a) => a.activity_type === "page_view").length || 0;
      const actions = activities?.filter((a) => 
        ["medication_logged", "symptom_logged", "profile_updated"].includes(a.activity_type)
      ).length || 0;

      // Normalize app usage: expect ~1 login/day, ~5 page views/day, ~2 actions/day
      const expectedLogins = days;
      const expectedPageViews = days * 5;
      const expectedActions = days * 2;
      
      const loginScore = Math.min((logins / expectedLogins) * 100, 100);
      const pageViewScore = Math.min((pageViews / expectedPageViews) * 100, 100);
      const actionScore = Math.min((actions / expectedActions) * 100, 100);
      const appUsageScore = (loginScore * 0.3 + pageViewScore * 0.3 + actionScore * 0.4);

      // 3. Calculate notification responsiveness
      const { data: notifications } = await supabase
        .from("notification_history")
        .select("status, opened_at, clicked_at")
        .eq("user_id", patientId)
        .gte("created_at", startDateStr);

      const sentCount = notifications?.length || 0;
      const openedCount = notifications?.filter((n) => n.opened_at).length || 0;
      const clickedCount = notifications?.filter((n) => n.clicked_at).length || 0;
      const openRate = sentCount > 0 ? (openedCount / sentCount) * 100 : 0;
      const clickRate = sentCount > 0 ? (clickedCount / sentCount) * 100 : 0;
      
      // Weight: opens 60%, clicks 40%
      const notificationScore = sentCount > 0 ? (openRate * 0.6 + clickRate * 0.4) : 50; // Default 50 if no notifications

      // Calculate overall score (weighted average)
      // Adherence: 50%, App Usage: 25%, Notifications: 25%
      const overallScore = (adherenceRate * 0.5) + (appUsageScore * 0.25) + (notificationScore * 0.25);

      // Determine risk level
      let riskLevel = "low";
      if (overallScore < 40) {
        riskLevel = "high";
      } else if (overallScore < 60) {
        riskLevel = "medium";
      }

      // Check if patient is transitioning to high risk
      const today = new Date().toISOString().split("T")[0];
      const { data: existingScore } = await supabase
        .from("patient_engagement_scores")
        .select("risk_level")
        .eq("user_id", patientId)
        .order("score_date", { ascending: false })
        .limit(1)
        .single();

      const wasHighRisk = existingScore?.risk_level === "high";
      const isNowHighRisk = riskLevel === "high";
      const transitionedToHighRisk = isNowHighRisk && !wasHighRisk;

      const metrics: EngagementMetrics = {
        adherence: {
          taken: takenCount,
          missed: missedCount,
          total: totalLogs,
          rate: adherenceRate,
        },
        appUsage: {
          logins,
          pageViews,
          actionsPerformed: actions,
        },
        notifications: {
          sent: sentCount,
          opened: openedCount,
          clicked: clickedCount,
          openRate,
          clickRate,
        },
      };

      // Upsert the engagement score
      const { error: upsertError } = await supabase
        .from("patient_engagement_scores")
        .upsert(
          {
            user_id: patientId,
            score_date: today,
            adherence_score: Math.round(adherenceRate * 100) / 100,
            app_usage_score: Math.round(appUsageScore * 100) / 100,
            notification_score: Math.round(notificationScore * 100) / 100,
            overall_score: Math.round(overallScore * 100) / 100,
            risk_level: riskLevel,
            metrics,
          },
          { onConflict: "user_id,score_date" }
        );

      if (upsertError) {
        console.error(`Error upserting score for ${patientId}:`, upsertError);
      } else {
        results.push({
          userId: patientId,
          overallScore: Math.round(overallScore * 100) / 100,
          riskLevel,
        });

        // Send alert to clinicians if patient transitioned to high risk
        if (transitionedToHighRisk) {
          console.info(`Patient ${patientId} transitioned to high risk - sending alerts`);
          
          // Get patient info
          const { data: patientProfile } = await supabase
            .from("profiles")
            .select("first_name, last_name, email")
            .eq("user_id", patientId)
            .single();

          // Get assigned clinicians
          const { data: assignments } = await supabase
            .from("clinician_patient_assignments")
            .select("clinician_user_id")
            .eq("patient_user_id", patientId);

          if (assignments && assignments.length > 0) {
            const clinicianIds = assignments.map((a) => a.clinician_user_id);
            
            // Get clinician emails
            const { data: clinicians } = await supabase
              .from("profiles")
              .select("user_id, first_name, last_name, email")
              .in("user_id", clinicianIds);

            const patientName = `${patientProfile?.first_name || "Unknown"} ${patientProfile?.last_name || ""}`.trim();

            // Send email to each clinician
            for (const clinician of clinicians || []) {
              if (!clinician.email) continue;

              try {
                await resend.emails.send({
                  from: "Pillaxia Alerts <alerts@pillaxia.com>",
                  to: [clinician.email],
                  subject: `⚠️ High Risk Alert: ${patientName} needs attention`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                      <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                        <h1 style="margin: 0; font-size: 24px;">⚠️ Patient Engagement Alert</h1>
                      </div>
                      <div style="background: #fef2f2; padding: 20px; border: 1px solid #fecaca;">
                        <p style="margin: 0 0 16px 0; font-size: 16px;">
                          Dear ${clinician.first_name || "Clinician"},
                        </p>
                        <p style="margin: 0 0 16px 0; font-size: 16px;">
                          Your patient <strong>${patientName}</strong> has been flagged as <strong style="color: #dc2626;">high risk</strong> based on their engagement metrics.
                        </p>
                        <div style="background: white; padding: 16px; border-radius: 8px; margin: 16px 0;">
                          <h3 style="margin: 0 0 12px 0; color: #374151;">Engagement Summary</h3>
                          <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Overall Score</td>
                              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #dc2626;">${Math.round(overallScore)}%</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Adherence</td>
                              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${Math.round(adherenceRate)}%</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">App Usage</td>
                              <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${Math.round(appUsageScore)}%</td>
                            </tr>
                            <tr>
                              <td style="padding: 8px 0;">Notification Response</td>
                              <td style="padding: 8px 0; text-align: right;">${Math.round(notificationScore)}%</td>
                            </tr>
                          </table>
                        </div>
                        <p style="margin: 16px 0 0 0; font-size: 14px; color: #6b7280;">
                          Consider reaching out to this patient to provide additional support and encourage medication adherence.
                        </p>
                      </div>
                      <div style="background: #f3f4f6; padding: 16px; border-radius: 0 0 8px 8px; text-align: center;">
                        <p style="margin: 0; font-size: 12px; color: #6b7280;">
                          This is an automated alert from Pillaxia's engagement monitoring system.
                        </p>
                      </div>
                    </div>
                  `,
                });
                console.info(`Alert email sent to clinician ${clinician.email} for patient ${patientId}`);
              } catch (emailError) {
                console.error(`Failed to send alert email to ${clinician.email}:`, emailError);
              }
            }
          }
        }
      }
    }

  console.info(`Successfully calculated scores for ${results.length} patients`);

  return new Response(
    JSON.stringify({ success: true, processed: results.length, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}));
