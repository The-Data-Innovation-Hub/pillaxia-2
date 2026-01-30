/**
 * Edge function to calculate patient risk flags for clinicians.
 * Optimized to use batch queries instead of N+1 individual queries.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

interface Assignment {
  clinician_user_id: string;
  patient_user_id: string;
}

interface RiskFlag {
  patient_user_id: string;
  clinician_user_id: string;
  flag_type: string;
  severity: string;
  description: string;
  metric_value?: number;
  days_since_last_log?: number;
}

serve(withSentry("calculate-patient-risks", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Calculating patient risk flags (optimized batch queries)...");
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

    if (!assignments || assignments.length === 0) {
      return new Response(
        JSON.stringify({ success: true, flagsProcessed: 0, message: "No assignments found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${assignments.length} clinician-patient assignments`);

    // Extract unique patient IDs
    const patientIds = [...new Set(assignments.map((a: Assignment) => a.patient_user_id))];

    // BATCH QUERY 1: Get recent logs (last 3 days) for all patients at once
    const { data: recentLogs, error: recentLogsError } = await supabase
      .from("medication_logs")
      .select("user_id, created_at")
      .in("user_id", patientIds)
      .gte("created_at", threeDaysAgo.toISOString());

    if (recentLogsError) {
      console.error("Error fetching recent logs:", recentLogsError);
      throw recentLogsError;
    }

    // Create set of patients with recent activity
    const patientsWithRecentActivity = new Set(
      (recentLogs || []).map((log: { user_id: string }) => log.user_id)
    );

    // BATCH QUERY 2: Get last log date for patients without recent activity
    const inactivePatients = patientIds.filter(
      (id) => !patientsWithRecentActivity.has(id)
    );

    const lastLogByPatient: Record<string, Date | null> = {};

    if (inactivePatients.length > 0) {
      // Get the most recent log for each inactive patient
      const { data: lastLogs, error: lastLogsError } = await supabase
        .from("medication_logs")
        .select("user_id, created_at")
        .in("user_id", inactivePatients)
        .order("created_at", { ascending: false });

      if (lastLogsError) {
        console.error("Error fetching last logs:", lastLogsError);
        // Don't throw - continue with partial data
      }

      // Build map of last log per patient
      for (const log of lastLogs || []) {
        if (!lastLogByPatient[log.user_id]) {
          lastLogByPatient[log.user_id] = new Date(log.created_at);
        }
      }
    }

    // BATCH QUERY 3: Get 2-week adherence data for all patients
    const { data: adherenceLogs, error: adherenceError } = await supabase
      .from("medication_logs")
      .select("user_id, status")
      .in("user_id", patientIds)
      .gte("scheduled_time", twoWeeksAgo.toISOString())
      .lte("scheduled_time", now.toISOString());

    if (adherenceError) {
      console.error("Error fetching adherence logs:", adherenceError);
      throw adherenceError;
    }

    // Calculate adherence per patient
    const adherenceByPatient: Record<string, { total: number; taken: number }> = {};
    for (const log of adherenceLogs || []) {
      if (!adherenceByPatient[log.user_id]) {
        adherenceByPatient[log.user_id] = { total: 0, taken: 0 };
      }
      adherenceByPatient[log.user_id].total++;
      if (log.status === "taken") {
        adherenceByPatient[log.user_id].taken++;
      }
    }

    // Build risk flags from aggregated data
    const riskFlags: RiskFlag[] = [];

    for (const assignment of assignments as Assignment[]) {
      const { patient_user_id, clinician_user_id } = assignment;

      // Check for no logging (3+ days)
      if (!patientsWithRecentActivity.has(patient_user_id)) {
        const lastLogDate = lastLogByPatient[patient_user_id] || null;
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

      // Check for low adherence (<70%)
      const adherence = adherenceByPatient[patient_user_id];
      if (adherence && adherence.total > 0) {
        const adherenceRate = (adherence.taken / adherence.total) * 100;

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

    console.log(`Found ${riskFlags.length} risk flags to process`);

    // BATCH QUERY 4: Get existing unresolved flags
    const { data: existingFlags, error: existingError } = await supabase
      .from("patient_risk_flags")
      .select("id, patient_user_id, clinician_user_id, flag_type")
      .eq("is_resolved", false);

    if (existingError) {
      console.error("Error fetching existing flags:", existingError);
      throw existingError;
    }

    // Build lookup for existing flags
    const existingFlagKeys = new Set(
      (existingFlags || []).map(
        (f: { patient_user_id: string; clinician_user_id: string; flag_type: string }) =>
          `${f.patient_user_id}:${f.clinician_user_id}:${f.flag_type}`
      )
    );

    // Separate new flags from updates
    const newFlags: RiskFlag[] = [];
    const updateFlags: RiskFlag[] = [];

    for (const flag of riskFlags) {
      const key = `${flag.patient_user_id}:${flag.clinician_user_id}:${flag.flag_type}`;
      if (existingFlagKeys.has(key)) {
        updateFlags.push(flag);
      } else {
        newFlags.push(flag);
      }
    }

    // BATCH INSERT new flags
    if (newFlags.length > 0) {
      const { error: insertError } = await supabase
        .from("patient_risk_flags")
        .insert(newFlags);

      if (insertError) {
        console.error("Error batch inserting risk flags:", insertError);
      } else {
        console.log(`Inserted ${newFlags.length} new risk flags`);
      }
    }

    // UPDATE existing flags (batch by similar updates)
    for (const flag of updateFlags) {
      const { error: updateError } = await supabase
        .from("patient_risk_flags")
        .update({
          severity: flag.severity,
          description: flag.description,
          metric_value: flag.metric_value,
          days_since_last_log: flag.days_since_last_log,
        })
        .eq("patient_user_id", flag.patient_user_id)
        .eq("clinician_user_id", flag.clinician_user_id)
        .eq("flag_type", flag.flag_type)
        .eq("is_resolved", false);

      if (updateError) {
        console.error("Error updating risk flag:", updateError);
      }
    }

    // Auto-resolve flags that no longer apply
    const currentFlagKeys = new Set(
      riskFlags.map((f) => `${f.patient_user_id}:${f.clinician_user_id}:${f.flag_type}`)
    );

    const flagsToResolve = (existingFlags || []).filter(
      (f: { patient_user_id: string; clinician_user_id: string; flag_type: string }) => {
        const key = `${f.patient_user_id}:${f.clinician_user_id}:${f.flag_type}`;
        return !currentFlagKeys.has(key);
      }
    );

    if (flagsToResolve.length > 0) {
      const idsToResolve = flagsToResolve.map((f: { id: string }) => f.id);
      const { error: resolveError } = await supabase
        .from("patient_risk_flags")
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          description: "Auto-resolved: condition no longer applies",
        })
        .in("id", idsToResolve);

      if (resolveError) {
        console.error("Error resolving flags:", resolveError);
      } else {
        console.log(`Auto-resolved ${flagsToResolve.length} flags`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        flagsProcessed: riskFlags.length,
        newFlags: newFlags.length,
        updatedFlags: updateFlags.length,
        resolvedFlags: flagsToResolve.length,
        message: `Processed ${riskFlags.length} risk flags using batch queries`,
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
