import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId, days = 7 } = await req.json().catch(() => ({}));
    
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
      throw patientsError;
    }

    console.log(`Processing engagement scores for ${patients?.length || 0} patients`);

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
      const today = new Date().toISOString().split("T")[0];
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
      }
    }

    console.log(`Successfully calculated scores for ${results.length} patients`);

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error calculating engagement scores:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
