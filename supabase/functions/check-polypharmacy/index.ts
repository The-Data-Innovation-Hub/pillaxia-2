import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

const POLYPHARMACY_THRESHOLD = 5; // 5+ active medications triggers warning

serve(withSentry("check-polypharmacy", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking for polypharmacy risks...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all patients with their active medication counts
    const { data: medicationCounts, error: countError } = await supabase
      .from("medications")
      .select("user_id")
      .eq("is_active", true);

    if (countError) {
      console.error("Error fetching medications:", countError);
      throw countError;
    }

    // Count medications per user
    const userMedCounts = new Map<string, number>();
    for (const med of medicationCounts || []) {
      const current = userMedCounts.get(med.user_id) || 0;
      userMedCounts.set(med.user_id, current + 1);
    }

    // Find patients with polypharmacy risk
    const patientsAtRisk: { userId: string; count: number }[] = [];
    for (const [userId, count] of userMedCounts) {
      if (count >= POLYPHARMACY_THRESHOLD) {
        patientsAtRisk.push({ userId, count });
      }
    }

    console.log(`Found ${patientsAtRisk.length} patients with ${POLYPHARMACY_THRESHOLD}+ medications`);

    if (patientsAtRisk.length === 0) {
      return new Response(
        JSON.stringify({ message: "No polypharmacy risks found", warnings_created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let warningsCreated = 0;
    let warningsUpdated = 0;

    for (const patient of patientsAtRisk) {
      // Check if warning already exists
      const { data: existingWarning } = await supabase
        .from("polypharmacy_warnings")
        .select("id, medication_count, is_acknowledged")
        .eq("patient_user_id", patient.userId)
        .maybeSingle();

      if (existingWarning) {
        // Update count if changed
        if (existingWarning.medication_count !== patient.count) {
          await supabase
            .from("polypharmacy_warnings")
            .update({ 
              medication_count: patient.count,
              is_acknowledged: false, // Reset acknowledgment on change
              acknowledged_at: null,
              acknowledged_by: null,
            })
            .eq("id", existingWarning.id);
          warningsUpdated++;
        }
        continue;
      }

      // Create new warning
      const { error: insertError } = await supabase
        .from("polypharmacy_warnings")
        .insert({
          patient_user_id: patient.userId,
          medication_count: patient.count,
        });

      if (insertError) {
        console.error("Error creating warning:", insertError);
        continue;
      }

      warningsCreated++;
    }

    // Clean up warnings for patients no longer at risk
    const patientIdsAtRisk = patientsAtRisk.map(p => p.userId);
    
    const { data: existingWarnings } = await supabase
      .from("polypharmacy_warnings")
      .select("id, patient_user_id");

    for (const warning of existingWarnings || []) {
      if (!patientIdsAtRisk.includes(warning.patient_user_id)) {
        await supabase
          .from("polypharmacy_warnings")
          .delete()
          .eq("id", warning.id);
        console.log(`Removed warning for patient ${warning.patient_user_id} (no longer at risk)`);
      }
    }

    console.log(`Polypharmacy check complete: ${warningsCreated} created, ${warningsUpdated} updated`);

    return new Response(
      JSON.stringify({ 
        message: "Polypharmacy check complete", 
        warnings_created: warningsCreated,
        warnings_updated: warningsUpdated,
        patients_at_risk: patientsAtRisk.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-polypharmacy:", error);
    captureException(error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}));
