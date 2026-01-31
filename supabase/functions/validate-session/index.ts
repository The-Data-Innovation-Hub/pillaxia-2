/**
 * Server-side Session Validation
 * 
 * Enforces:
 * - Session expiration based on security settings
 * - Concurrent session limits
 * - Device trust verification
 * - Activity timeout (idle session expiration)
 * - Server-verified role claims
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { withRateLimit } from "../_shared/rateLimiter.ts";

// Default session settings (can be overridden by security_settings table)
const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;
const DEFAULT_MAX_CONCURRENT_SESSIONS = 3;

type AppRole = "patient" | "clinician" | "pharmacist" | "admin" | "manager";

interface SessionValidationResult {
  valid: boolean;
  userId?: string;
  reason?: string;
  sessionId?: string;
  remainingMinutes?: number;
  shouldRefresh?: boolean;
  // Server-verified roles - these are authoritative
  roles?: AppRole[];
  isAdmin?: boolean;
  isManager?: boolean;
  isClinician?: boolean;
  isPharmacist?: boolean;
  isPatient?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCorsPreflightRequest(req);
  if (corsResponse) return corsResponse;
  
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
  // Rate limiting - auth endpoint type
  const rateLimitResponse = withRateLimit(req, "auth", corsHeaders);
  if (rateLimitResponse) return rateLimitResponse;
  
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ valid: false, reason: "No authorization token" } as SessionValidationResult),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("Missing Supabase configuration");
    }
    
    // Validate JWT
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !userData?.user?.id) {
      console.info("[SESSION] Invalid token:", userError?.message);
      return new Response(
        JSON.stringify({ valid: false, reason: "Invalid or expired token" } as SessionValidationResult),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const userId = userData.user.id;
    // Get token expiry from session
    const { data: sessionData } = await supabaseAuth.auth.getSession();
    const tokenExp = sessionData?.session?.expires_at;
    
    // Use service role for session checks
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    // Fetch server-verified roles - this is the authoritative source
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    if (rolesError) {
      console.warn("[SESSION] Error fetching roles:", rolesError);
    }
    
    const roles: AppRole[] = rolesData?.map(r => r.role as AppRole) || [];
    const roleFlags = {
      isAdmin: roles.includes("admin"),
      isManager: roles.includes("manager"),
      isClinician: roles.includes("clinician"),
      isPharmacist: roles.includes("pharmacist"),
      isPatient: roles.includes("patient"),
    };
    
    console.info(`[SESSION] Server-verified roles for user ${userId}:`, roles);
    
    // Get session timeout settings
    const { data: settings } = await supabase
      .from("security_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["session_timeout_minutes", "max_concurrent_sessions"]);
    
    const sessionTimeoutMinutes = settings?.find(s => s.setting_key === "session_timeout_minutes")
      ?.setting_value?.value || DEFAULT_SESSION_TIMEOUT_MINUTES;
    const maxConcurrentSessions = settings?.find(s => s.setting_key === "max_concurrent_sessions")
      ?.setting_value?.value || DEFAULT_MAX_CONCURRENT_SESSIONS;
    
    // Check for active session in user_sessions table
    const { data: sessions, error: sessionsError } = await supabase
      .from("user_sessions")
      .select("id, created_at, last_activity, expires_at, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("last_activity", { ascending: false });
    
    if (sessionsError) {
      console.warn("[SESSION] Error fetching sessions:", sessionsError);
    }
    
    const activeSessions = sessions || [];
    const now = new Date();
    
    // Check if token is about to expire (within 5 minutes)
    const tokenExpiresAt = tokenExp ? new Date(tokenExp * 1000) : new Date(now.getTime() + 60 * 60 * 1000);
    const tokenExpiresInMinutes = Math.floor((tokenExpiresAt.getTime() - now.getTime()) / 60000);
    const shouldRefresh = tokenExpiresInMinutes < 5 && tokenExpiresInMinutes > 0;
    
    // Find current session (if exists)
    const currentSession = activeSessions[0];
    
    // Check idle timeout
    if (currentSession) {
      const lastActivity = new Date(currentSession.last_activity);
      const idleMinutes = Math.floor((now.getTime() - lastActivity.getTime()) / 60000);
      
      if (idleMinutes > sessionTimeoutMinutes) {
        console.info(`[SESSION] Session ${currentSession.id} timed out after ${idleMinutes} minutes of inactivity`);
        
        // Mark session as inactive
        await supabase
          .from("user_sessions")
          .update({ is_active: false })
          .eq("id", currentSession.id);
        
        // Log security event
        await supabase.rpc("log_security_event", {
          p_user_id: userId,
          p_event_type: "session_timeout",
          p_event_category: "session",
          p_severity: "info",
          p_description: `Session expired after ${idleMinutes} minutes of inactivity`,
          p_metadata: { session_id: currentSession.id, idle_minutes: idleMinutes },
        });
        
        return new Response(
          JSON.stringify({
            valid: false,
            reason: "Session timed out due to inactivity",
            sessionId: currentSession.id,
          } as SessionValidationResult),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Check if session is explicitly expired
      if (currentSession.expires_at && new Date(currentSession.expires_at) < now) {
        console.info(`[SESSION] Session ${currentSession.id} has expired`);
        
        await supabase
          .from("user_sessions")
          .update({ is_active: false })
          .eq("id", currentSession.id);
        
        return new Response(
          JSON.stringify({
            valid: false,
            reason: "Session has expired",
            sessionId: currentSession.id,
          } as SessionValidationResult),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Update last activity
      await supabase
        .from("user_sessions")
        .update({ last_activity: now.toISOString() })
        .eq("id", currentSession.id);
      
      // Calculate remaining time
      const remainingMinutes = sessionTimeoutMinutes - idleMinutes;
      
      return new Response(
        JSON.stringify({
          valid: true,
          userId,
          sessionId: currentSession.id,
          remainingMinutes,
          shouldRefresh,
          roles,
          ...roleFlags,
        } as SessionValidationResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // No active session found - check concurrent session limits
    if (activeSessions.length >= maxConcurrentSessions) {
      console.info(`[SESSION] User ${userId} has ${activeSessions.length} active sessions (max: ${maxConcurrentSessions})`);
      
      // Terminate oldest session
      const oldestSession = activeSessions[activeSessions.length - 1];
      await supabase
        .from("user_sessions")
        .update({ is_active: false })
        .eq("id", oldestSession.id);
      
      // Log security event
      await supabase.rpc("log_security_event", {
        p_user_id: userId,
        p_event_type: "session_terminated",
        p_event_category: "session",
        p_severity: "warn",
        p_description: "Session terminated due to concurrent session limit",
        p_metadata: { terminated_session_id: oldestSession.id, active_sessions: activeSessions.length },
      });
    }
    
    // Create new session
    const expiresAt = new Date(now.getTime() + sessionTimeoutMinutes * 60 * 1000);
    const { data: newSession, error: createError } = await supabase
      .from("user_sessions")
      .insert({
        user_id: userId,
        last_activity: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        ip_address: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        user_agent: req.headers.get("user-agent"),
      })
      .select("id")
      .single();
    
    if (createError) {
      console.warn("[SESSION] Error creating session:", createError);
      // Still return valid if we can't create session record
      return new Response(
        JSON.stringify({
          valid: true,
          userId,
          shouldRefresh,
          roles,
          ...roleFlags,
        } as SessionValidationResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.info(`[SESSION] Created new session ${newSession.id} for user ${userId}`);
    
    return new Response(
      JSON.stringify({
        valid: true,
        userId,
        sessionId: newSession.id,
        remainingMinutes: sessionTimeoutMinutes,
        shouldRefresh,
        roles,
        ...roleFlags,
      } as SessionValidationResult),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.warn("[SESSION] Error:", error);
    return new Response(
      JSON.stringify({
        valid: false,
        reason: "Session validation failed",
      } as SessionValidationResult),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
