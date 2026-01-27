import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking medication expiry dates...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Get all controlled drugs with expiry dates
    const { data: expiringDrugs, error: fetchError } = await supabase
      .from("controlled_drugs")
      .select("id, name, strength, form, expiry_date, current_stock, expiry_alert_sent")
      .eq("is_active", true)
      .not("expiry_date", "is", null)
      .lte("expiry_date", thirtyDaysFromNow.toISOString().split("T")[0])
      .order("expiry_date", { ascending: true });

    if (fetchError) {
      console.error("Error fetching expiring drugs:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiringDrugs?.length || 0} medications expiring within 30 days`);

    const alerts: Array<{
      drug_id: string;
      name: string;
      expiry_date: string;
      days_until_expiry: number;
      severity: "critical" | "warning" | "expired";
      current_stock: number;
    }> = [];

    for (const drug of expiringDrugs || []) {
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

      alerts.push({
        drug_id: drug.id,
        name: drug.name,
        expiry_date: drug.expiry_date,
        days_until_expiry: daysUntilExpiry,
        severity,
        current_stock: drug.current_stock,
      });

      // Mark alert as sent for critical/expired items not yet notified
      if (!drug.expiry_alert_sent && (severity === "critical" || severity === "expired")) {
        await supabase
          .from("controlled_drugs")
          .update({ expiry_alert_sent: true })
          .eq("id", drug.id);
        
        console.log(`Marked expiry alert sent for ${drug.name} (${severity})`);
      }
    }

    // Group by severity for summary
    const summary = {
      expired: alerts.filter(a => a.severity === "expired").length,
      critical: alerts.filter(a => a.severity === "critical").length,
      warning: alerts.filter(a => a.severity === "warning").length,
      total: alerts.length,
    };

    console.log("Expiry check summary:", summary);

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary,
        alerts,
        message: `Found ${summary.total} medications with expiry concerns`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error checking medication expiry:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
