import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { validateSchema, validationErrorResponse, validators } from "../_shared/validation.ts";

/**
 * Organization Customer Portal
 * 
 * Creates a Stripe Customer Portal session for organization billing management.
 * 
 * Security:
 * - Validates JWT authentication
 * - Verifies user is org admin/owner
 * - Validates organization has Stripe customer
 */

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.info(`[ORG-CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

// Input validation schema
const portalRequestSchema = {
  organizationId: validators.uuid(),
};

serve(withSentry("org-customer-portal", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Validate Stripe key exists
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    // Validate authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify JWT and get user
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims?.sub) {
      logStep("Authentication failed", { error: claimsError?.message });
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    logStep("User authenticated", { userId });

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validation = validateSchema(portalRequestSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation, corsHeaders);
    }

    const { organizationId } = validation.data;
    logStep("Organization ID validated", { organizationId });

    // Verify user is org admin/owner
    const { data: membership, error: memberError } = await supabaseClient
      .from("organization_members")
      .select("org_role")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (memberError) {
      logStep("Membership query failed", { error: memberError.message });
      throw new Error("Failed to verify organization membership");
    }

    if (!membership) {
      logStep("User not a member", { userId, organizationId });
      return new Response(JSON.stringify({ error: "User is not a member of this organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["admin", "owner"].includes(membership.org_role)) {
      logStep("Insufficient permissions", { userId, role: membership.org_role });
      return new Response(JSON.stringify({ error: "Only organization admins can access billing portal" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get subscription with Stripe customer ID
    const { data: subscription, error: subError } = await supabaseClient
      .from("organization_subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (subError) {
      logStep("Subscription query failed", { error: subError.message });
      throw new Error("Failed to retrieve subscription information");
    }

    if (!subscription?.stripe_customer_id) {
      logStep("No Stripe customer found", { organizationId });
      return new Response(JSON.stringify({ error: "No billing account found for this organization" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found Stripe customer", { customerId: subscription.stripe_customer_id });

    // Create Stripe portal session
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const origin = req.headers.get("origin") || "https://pillaxia-craft-suite.lovable.app";
    
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/dashboard/organization?tab=billing`,
    });

    logStep("Portal session created", { sessionId: portalSession.id });

    return new Response(JSON.stringify({ url: portalSession.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    captureException(error instanceof Error ? error : new Error(errorMessage));
    
    return new Response(JSON.stringify({ error: "An error occurred while creating the billing portal session" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}));
