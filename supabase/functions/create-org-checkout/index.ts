import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, withSentry, captureException } from "../_shared/sentry.ts";
import { validators, validateSchema, validationErrorResponse } from "../_shared/validation.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.info(`[CREATE-ORG-CHECKOUT] ${step}${detailsStr}`);
};

// Pricing tiers
const PRICING_TIERS = {
  starter: {
    priceId: "price_1SubmFRzXjja5wsGVBObpv52",
    productId: "prod_TsMV1jOIMSReVf",
    name: "Starter Clinic",
    seats: 10,
  },
  professional: {
    priceId: "price_1SubmmRzXjja5wsGywesczVP",
    productId: "prod_TsMVsjHaYgBgLZ",
    name: "Professional Practice",
    seats: 50,
  },
  enterprise: {
    priceId: "price_1SubgARzXjja5wsGvBKZNMax",
    productId: "prod_TsMOjz7Pt8ugAx",
    name: "Large Hospital",
    seats: 500,
  },
};

// Input validation schema
const checkoutSchema = {
  organizationId: validators.uuid(),
  tier: validators.enum(["starter", "professional", "enterprise"]),
  seats: validators.optional(validators.number({ min: 1, max: 10000 })),
};

serve(withSentry("create-org-checkout", async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse and validate request body
    const body = await req.json().catch(() => ({}));
    const validation = validateSchema(checkoutSchema, body);

    if (!validation.success) {
      return validationErrorResponse(validation, corsHeaders);
    }

    const { organizationId, tier, seats } = body as {
      organizationId: string;
      tier: keyof typeof PRICING_TIERS;
      seats?: number;
    };

    const selectedTier = PRICING_TIERS[tier];
    logStep("Selected tier", { tier, priceId: selectedTier.priceId });

    // Verify user is org admin
    const { data: membership, error: memberError } = await supabaseClient
      .from("organization_members")
      .select("org_role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (memberError || !membership) {
      throw new Error("User is not a member of this organization");
    }

    if (!["admin", "owner"].includes(membership.org_role)) {
      throw new Error("Only organization admins can manage billing");
    }

    // Get organization details
    const { data: org, error: orgError } = await supabaseClient
      .from("organizations")
      .select("*")
      .eq("id", organizationId)
      .single();

    if (orgError || !org) throw new Error("Organization not found");
    logStep("Organization found", { orgName: org.name });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if organization already has a Stripe customer
    const { data: existingSub } = await supabaseClient
      .from("organization_subscriptions")
      .select("stripe_customer_id")
      .eq("organization_id", organizationId)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id;

    if (!customerId) {
      // Search for existing customer by email
      const customers = await stripe.customers.list({
        email: org.contact_email || user.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }
    logStep("Customer ID resolved", { customerId: customerId || "new customer" });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : (org.contact_email || user.email),
      line_items: [
        {
          price: selectedTier.priceId,
          quantity: seats || 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/dashboard/organization?billing=success`,
      cancel_url: `${req.headers.get("origin")}/dashboard/organization?billing=canceled`,
      metadata: {
        organization_id: organizationId,
        tier: tier,
        seats: String(seats || selectedTier.seats),
      },
      subscription_data: {
        metadata: {
          organization_id: organizationId,
          tier: tier,
        },
      },
      allow_promotion_codes: true,
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    captureException(error instanceof Error ? error : new Error(errorMessage));
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}));
