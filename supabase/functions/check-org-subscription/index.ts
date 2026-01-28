import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-ORG-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Tier mapping
const PRODUCT_TIERS: Record<string, string> = {
  "prod_TsMV1jOIMSReVf": "starter",
  "prod_TsMVsjHaYgBgLZ": "professional",
  "prod_TsMOjz7Pt8ugAx": "enterprise",
};

serve(async (req) => {
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
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse request
    const { organizationId } = await req.json();
    if (!organizationId) throw new Error("Organization ID is required");

    // Get subscription from database
    const { data: subscription, error: subError } = await supabaseClient
      .from("organization_subscriptions")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (subError) {
      throw new Error(`Database error: ${subError.message}`);
    }

    if (!subscription) {
      logStep("No subscription found");
      return new Response(JSON.stringify({
        subscribed: false,
        tier: null,
        seats_purchased: 0,
        seats_used: 0,
        subscription_end: null,
        status: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Calculate seats used
    const { count: seatsUsed } = await supabaseClient
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    // Optionally sync with Stripe for fresh data
    if (subscription.stripe_subscription_id) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      
      try {
        const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        
        // Update local record if status changed
        if (stripeSub.status !== subscription.status) {
          await supabaseClient
            .from("organization_subscriptions")
            .update({
              status: stripeSub.status,
              current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: stripeSub.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", organizationId);

          subscription.status = stripeSub.status;
          subscription.current_period_end = new Date(stripeSub.current_period_end * 1000).toISOString();
        }
      } catch (stripeError) {
        logStep("Stripe sync failed, using cached data", { error: String(stripeError) });
      }
    }

    const tier = subscription.stripe_product_id 
      ? PRODUCT_TIERS[subscription.stripe_product_id] || "unknown"
      : null;

    const isActive = ["active", "trialing"].includes(subscription.status);

    logStep("Subscription found", { 
      tier, 
      status: subscription.status,
      seatsUsed,
      seatsPurchased: subscription.seats_purchased 
    });

    return new Response(JSON.stringify({
      subscribed: isActive,
      tier,
      status: subscription.status,
      seats_purchased: subscription.seats_purchased,
      seats_used: seatsUsed || 0,
      subscription_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      stripe_customer_id: subscription.stripe_customer_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
