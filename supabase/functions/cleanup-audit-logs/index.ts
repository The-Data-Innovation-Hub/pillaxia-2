/**
 * Audit Log Retention Cleanup
 * 
 * Implements HIPAA-compliant 7-year retention policy for audit logs.
 * Scheduled to run daily via pg_cron.
 * 
 * Retention periods:
 * - audit_log: 7 years (HIPAA requirement)
 * - data_access_log: 7 years (HIPAA PHI access tracking)
 * - security_events: 7 years (security incident tracking)
 * - login_attempts: 90 days (operational data)
 * - notification_history: 1 year (operational data)
 * - account_lockouts: 90 days (already unlocked entries only)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// Retention periods in days
const RETENTION_POLICIES = {
  // HIPAA-required 7-year retention
  audit_log: 7 * 365,              // 2555 days
  data_access_log: 7 * 365,        // 2555 days
  security_events: 7 * 365,        // 2555 days
  compliance_reports: 7 * 365,     // 2555 days
  
  // Operational data - shorter retention
  login_attempts: 90,              // 90 days
  notification_history: 365,       // 1 year
  account_lockouts_unlocked: 90,   // 90 days (only unlocked entries)
};

interface CleanupResult {
  table: string;
  deleted: number;
  retentionDays: number;
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    // Verify this is called from cron or admin
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }
    
    // Allow cron calls (with anon key) or authenticated admin calls
    const isCronCall = authHeader?.includes(Deno.env.get("SUPABASE_ANON_KEY") || "");
    
    if (!isCronCall) {
      // Verify admin access for manual triggers
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
        global: { headers: { Authorization: authHeader || "" } },
      });
      const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
      
      if (userError || !userData?.user?.id) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Check if user is admin
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .single();
      
      if (!roles) {
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Use service role for cleanup operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const results: CleanupResult[] = [];
    const now = new Date();
    
    console.log("[CLEANUP] Starting audit log retention cleanup");
    console.log(`[CLEANUP] Current time: ${now.toISOString()}`);
    
    // Cleanup audit_log
    const auditCutoff = new Date(now.getTime() - RETENTION_POLICIES.audit_log * 24 * 60 * 60 * 1000);
    const { count: auditDeleted } = await supabase
      .from("audit_log")
      .delete({ count: "exact" })
      .lt("created_at", auditCutoff.toISOString());
    
    results.push({
      table: "audit_log",
      deleted: auditDeleted || 0,
      retentionDays: RETENTION_POLICIES.audit_log,
    });
    console.log(`[CLEANUP] audit_log: deleted ${auditDeleted || 0} records older than ${auditCutoff.toISOString()}`);
    
    // Cleanup data_access_log
    const accessCutoff = new Date(now.getTime() - RETENTION_POLICIES.data_access_log * 24 * 60 * 60 * 1000);
    const { count: accessDeleted } = await supabase
      .from("data_access_log")
      .delete({ count: "exact" })
      .lt("created_at", accessCutoff.toISOString());
    
    results.push({
      table: "data_access_log",
      deleted: accessDeleted || 0,
      retentionDays: RETENTION_POLICIES.data_access_log,
    });
    console.log(`[CLEANUP] data_access_log: deleted ${accessDeleted || 0} records older than ${accessCutoff.toISOString()}`);
    
    // Cleanup security_events
    const securityCutoff = new Date(now.getTime() - RETENTION_POLICIES.security_events * 24 * 60 * 60 * 1000);
    const { count: securityDeleted } = await supabase
      .from("security_events")
      .delete({ count: "exact" })
      .lt("created_at", securityCutoff.toISOString());
    
    results.push({
      table: "security_events",
      deleted: securityDeleted || 0,
      retentionDays: RETENTION_POLICIES.security_events,
    });
    console.log(`[CLEANUP] security_events: deleted ${securityDeleted || 0} records older than ${securityCutoff.toISOString()}`);
    
    // Cleanup login_attempts (shorter retention)
    const loginCutoff = new Date(now.getTime() - RETENTION_POLICIES.login_attempts * 24 * 60 * 60 * 1000);
    const { count: loginDeleted } = await supabase
      .from("login_attempts")
      .delete({ count: "exact" })
      .lt("created_at", loginCutoff.toISOString());
    
    results.push({
      table: "login_attempts",
      deleted: loginDeleted || 0,
      retentionDays: RETENTION_POLICIES.login_attempts,
    });
    console.log(`[CLEANUP] login_attempts: deleted ${loginDeleted || 0} records older than ${loginCutoff.toISOString()}`);
    
    // Cleanup notification_history
    const notifCutoff = new Date(now.getTime() - RETENTION_POLICIES.notification_history * 24 * 60 * 60 * 1000);
    const { count: notifDeleted } = await supabase
      .from("notification_history")
      .delete({ count: "exact" })
      .lt("created_at", notifCutoff.toISOString());
    
    results.push({
      table: "notification_history",
      deleted: notifDeleted || 0,
      retentionDays: RETENTION_POLICIES.notification_history,
    });
    console.log(`[CLEANUP] notification_history: deleted ${notifDeleted || 0} records older than ${notifCutoff.toISOString()}`);
    
    // Cleanup unlocked account_lockouts
    const lockoutCutoff = new Date(now.getTime() - RETENTION_POLICIES.account_lockouts_unlocked * 24 * 60 * 60 * 1000);
    const { count: lockoutDeleted } = await supabase
      .from("account_lockouts")
      .delete({ count: "exact" })
      .not("unlocked_at", "is", null)
      .lt("unlocked_at", lockoutCutoff.toISOString());
    
    results.push({
      table: "account_lockouts (unlocked only)",
      deleted: lockoutDeleted || 0,
      retentionDays: RETENTION_POLICIES.account_lockouts_unlocked,
    });
    console.log(`[CLEANUP] account_lockouts: deleted ${lockoutDeleted || 0} unlocked records older than ${lockoutCutoff.toISOString()}`);
    
    // Calculate totals
    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
    
    console.log(`[CLEANUP] Complete. Total records deleted: ${totalDeleted}`);
    
    // Log cleanup event to audit
    await supabase.from("audit_log").insert({
      action: "RETENTION_CLEANUP",
      target_table: "multiple",
      details: {
        results,
        totalDeleted,
        executedAt: now.toISOString(),
      },
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Audit log cleanup completed",
        totalDeleted,
        results,
        executedAt: now.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[CLEANUP] Error:", error);
    return new Response(
      JSON.stringify({
        error: "Cleanup failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
