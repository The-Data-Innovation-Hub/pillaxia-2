import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

serve(withSentry("check-missed-doses", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking for missed doses...");

    // Get grace period from settings (default to 30 minutes)
    let gracePeriodMinutes = 30;
    const { data: graceSetting, error: graceError } = await supabase
      .from("notification_settings")
      .select("description")
      .eq("setting_key", "missed_dose_grace_period")
      .maybeSingle();

    if (graceError) {
      console.error("Error fetching grace period setting:", graceError);
    } else if (graceSetting?.description) {
      const parsed = parseInt(graceSetting.description, 10);
      if (!isNaN(parsed) && parsed > 0) {
        gracePeriodMinutes = parsed;
      }
    }

    console.log("Using grace period of " + gracePeriodMinutes + " minutes");

    // Find pending medication logs that are past their scheduled time by more than the grace period
    const cutoffTime = new Date(Date.now() - gracePeriodMinutes * 60 * 1000).toISOString();
    
    const { data: pendingLogs, error: logsError } = await supabase
      .from("medication_logs")
      .select("id, user_id, medication_id, scheduled_time, medications(name)")
      .eq("status", "pending")
      .lt("scheduled_time", cutoffTime);

    if (logsError) {
      console.error("Error fetching pending logs:", logsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch pending logs" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!pendingLogs || pendingLogs.length === 0) {
      console.log("No missed doses found");
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No missed doses found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Found " + pendingLogs.length + " missed doses to process");

    let processed = 0;
    let failed = 0;

    for (const log of pendingLogs) {
      try {
        // Update the log status to 'missed'
        const { error: updateError } = await supabase
          .from("medication_logs")
          .update({ status: "missed" })
          .eq("id", log.id);

        if (updateError) {
          console.error("Error updating log " + log.id + ":", updateError);
          failed++;
          continue;
        }

        // Get medication name from the joined data
        const medicationData = log.medications as unknown as { name: string } | { name: string }[] | null;
        let medicationName = "Unknown Medication";
        if (medicationData) {
          if (Array.isArray(medicationData) && medicationData.length > 0) {
            medicationName = medicationData[0].name;
          } else if (!Array.isArray(medicationData)) {
            medicationName = medicationData.name;
          }
        }

        // Call the send-missed-dose-alerts function
        const { error: alertError } = await supabase.functions.invoke("send-missed-dose-alerts", {
          body: {
            patientUserId: log.user_id,
            medicationName: medicationName,
            scheduledTime: log.scheduled_time,
          },
        });

        if (alertError) {
          console.error("Error sending alert for log " + log.id + ":", alertError);
        }

        processed++;
        console.log("Processed missed dose: " + log.id);
      } catch (err) {
        console.error("Error processing log " + log.id + ":", err);
        failed++;
      }
    }

    console.log("Finished processing. Processed: " + processed + ", Failed: " + failed);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: pendingLogs.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-missed-doses:", error);
    captureException(error instanceof Error ? error : new Error(errorMessage));
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}));
