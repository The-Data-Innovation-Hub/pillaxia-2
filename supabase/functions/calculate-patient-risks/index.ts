import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

serve(withSentry("calculate-patient-risks", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Calculating patient risk flags...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Get all clinician-patient assignments
    const { data: assignments, error: assignError } = await supabase
      .from("clinician_patient_assignments")
      .select("clinician_user_id, patient_user_id");

    if (assignError) {
      console.error("Error fetching assignments:", assignError);
      throw assignError;
    }

    console.log(`Found ${assignments?.length || 0} clinician-patient assignments`);

    const riskFlags: Array<{
      patient_user_id: string;
      clinician_user_id: string;
      flag_type: string;
      severity: string;
      description: string;
      metric_value?: number;
      days_since_last_log?: number;
    }> = [];

    for (const assignment of assignments || []) {
      const { patient_user_id, clinician_user_id } = assignment;

      // Check for 3+ days no logging
      const { data: recentLogs, error: logError } = await supabase
        .from("medication_logs")
        .select("created_at")
        .eq("user_id", patient_user_id)
        .gte("created_at", threeDaysAgo.toISOString())
        .limit(1);

      if (logError) {
        console.error(`Error checking logs for patient ${patient_user_id}:`, logError);
        continue;
      }

      if (!recentLogs || recentLogs.length === 0) {
        // Get the last log date
        const { data: lastLog } = await supabase
          .from("medication_logs")
          .select("created_at")
          .eq("user_id", patient_user_id)
          .order("created_at", { ascending: false })
          .limit(1);

        const lastLogDate = lastLog?.[0]?.created_at 
          ? new Date(lastLog[0].created_at)
          : null;

        const daysSinceLastLog = lastLogDate 
          ? Math.floor((now.getTime() - lastLogDate.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        if (daysSinceLastLog >= 3) {
          riskFlags.push({
            patient_user_id,
            clinician_user_id,
            flag_type: "no_logging",
            severity: daysSinceLastLog >= 7 ? "critical" : "warning",
            description: `Patient has not logged any medication for ${daysSinceLastLog} days`,
            days_since_last_log: daysSinceLastLog,
          });
        }
      }

      // Check for <70% adherence over 2 weeks
      const { data: twoWeekLogs, error: adherenceError } = await supabase
        .from("medication_logs")
        .select("status")
        .eq("user_id", patient_user_id)
        .gte("scheduled_time", twoWeeksAgo.toISOString())
        .lte("scheduled_time", now.toISOString());

      if (adherenceError) {
        console.error(`Error checking adherence for patient ${patient_user_id}:`, adherenceError);
        continue;
      }

      if (twoWeekLogs && twoWeekLogs.length > 0) {
        const takenCount = twoWeekLogs.filter(log => log.status === "taken").length;
        const adherenceRate = (takenCount / twoWeekLogs.length) * 100;

        if (adherenceRate < 70) {
          riskFlags.push({
            patient_user_id,
            clinician_user_id,
            flag_type: "low_adherence",
            severity: adherenceRate < 50 ? "critical" : "warning",
            description: `Patient adherence is ${adherenceRate.toFixed(1)}% over the past 2 weeks`,
            metric_value: adherenceRate,
          });
        }
      }
    }

    console.log(`Found ${riskFlags.length} risk flags to upsert`);

    // Upsert risk flags (resolve old ones first, then insert new)
    if (riskFlags.length > 0) {
      for (const flag of riskFlags) {
        const { data: existing } = await supabase
          .from("patient_risk_flags")
          .select("id")
          .eq("patient_user_id", flag.patient_user_id)
          .eq("clinician_user_id", flag.clinician_user_id)
          .eq("flag_type", flag.flag_type)
          .eq("is_resolved", false)
          .maybeSingle();

        if (!existing) {
          const { error: insertError } = await supabase
            .from("patient_risk_flags")
            .insert(flag);

          if (insertError) {
            console.error("Error inserting risk flag:", insertError);
          }
        } else {
          const { error: updateError } = await supabase
            .from("patient_risk_flags")
            .update({
              severity: flag.severity,
              description: flag.description,
              metric_value: flag.metric_value,
              days_since_last_log: flag.days_since_last_log,
            })
            .eq("id", existing.id);

          if (updateError) {
            console.error("Error updating risk flag:", updateError);
          }
        }
      }
    }

    // Auto-resolve flags that no longer apply
    const patientClinicianPairs = riskFlags.map(f => ({
      patient: f.patient_user_id,
      clinician: f.clinician_user_id,
      type: f.flag_type,
    }));

    const { data: unresolvedFlags } = await supabase
      .from("patient_risk_flags")
      .select("id, patient_user_id, clinician_user_id, flag_type")
      .eq("is_resolved", false);

    for (const flag of unresolvedFlags || []) {
      const stillApplies = patientClinicianPairs.some(
        p => p.patient === flag.patient_user_id && 
             p.clinician === flag.clinician_user_id && 
             p.type === flag.flag_type
      );

      if (!stillApplies) {
        await supabase
          .from("patient_risk_flags")
          .update({ 
            is_resolved: true, 
            resolved_at: new Date().toISOString(),
            description: "Auto-resolved: condition no longer applies"
          })
          .eq("id", flag.id);
        console.log(`Auto-resolved flag ${flag.id}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        flagsProcessed: riskFlags.length,
        message: `Processed ${riskFlags.length} risk flags`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error calculating patient risks:", error);
    captureException(error instanceof Error ? error : new Error(errorMessage));
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
