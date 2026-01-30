import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { withSentry, captureException, captureMessage } from "../_shared/sentry.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const FUNCTION_NAME = "stripe-webhook";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(withSentry(FUNCTION_NAME, async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  
  if (!stripeKey) {
    logStep("ERROR", { message: "STRIPE_SECRET_KEY not configured" });
    await captureMessage("STRIPE_SECRET_KEY not configured", "error", { functionName: FUNCTION_NAME });
    return new Response(JSON.stringify({ error: "Configuration error" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  // SECURITY: Require webhook secret in production
  if (!webhookSecret) {
    const isProduction = Deno.env.get("ENVIRONMENT") === "production";
    if (isProduction) {
      logStep("ERROR", { message: "STRIPE_WEBHOOK_SECRET required in production" });
      await captureMessage("STRIPE_WEBHOOK_SECRET not configured in production", "fatal", { 
        functionName: FUNCTION_NAME 
      });
      return new Response(JSON.stringify({ error: "Configuration error" }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    logStep("WARNING: Webhook signature verification disabled (development only)");
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    let event: Stripe.Event;

    // SECURITY: Verify webhook signature (mandatory in production)
    if (webhookSecret) {
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        logStep("ERROR", { message: "Missing stripe-signature header" });
        await captureMessage("Missing Stripe signature header", "warning", { functionName: FUNCTION_NAME });
        return new Response(JSON.stringify({ error: "No Stripe signature found" }), { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      
      try {
        // IMPORTANT: Use async version for Deno SubtleCrypto compatibility
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      } catch (signatureError) {
        logStep("ERROR", { message: "Invalid signature", error: String(signatureError) });
        await captureMessage("Invalid Stripe webhook signature", "warning", { 
          functionName: FUNCTION_NAME 
        });
        return new Response(JSON.stringify({ error: "Invalid signature" }), { 
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    } else {
      // Development fallback
      event = JSON.parse(body);
    }

    logStep("Event received", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organization_id;
        if (!organizationId) {
          logStep("No organization_id in session metadata");
          break;
        }

        logStep("Checkout completed", { organizationId, customerId: session.customer });

        // Update or create subscription record
        const { error } = await supabase
          .from("organization_subscriptions")
          .upsert({
            organization_id: organizationId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            seats_purchased: parseInt(session.metadata?.seats || "10"),
            status: "active",
            updated_at: new Date().toISOString(),
          }, { onConflict: "organization_id" });

        if (error) {
          logStep("Error upserting subscription", { error: error.message });
          captureException(error);
        }

        // Log billing event
        await supabase.from("billing_events").insert({
          organization_id: organizationId,
          event_type: "checkout_completed",
          stripe_event_id: session.id,
          description: `Subscription checkout completed for ${session.metadata?.tier || "unknown"} plan`,
          amount: session.amount_total,
          currency: session.currency,
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organization_id;
        if (!organizationId) {
          logStep("No organization_id in subscription metadata");
          break;
        }

        logStep("Subscription updated", { 
          organizationId, 
          status: subscription.status,
          subscriptionId: subscription.id 
        });

        const { error } = await supabase
          .from("organization_subscriptions")
          .update({
            stripe_subscription_id: subscription.id,
            stripe_product_id: subscription.items.data[0]?.price.product as string,
            stripe_price_id: subscription.items.data[0]?.price.id,
            status: subscription.status as string,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at 
              ? new Date(subscription.canceled_at * 1000).toISOString() 
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId);

        if (error) {
          logStep("Error updating subscription", { error: error.message });
          captureException(error);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organization_id;
        if (!organizationId) {
          logStep("No organization_id in subscription metadata");
          break;
        }

        logStep("Subscription deleted", { organizationId });

        const { error } = await supabase
          .from("organization_subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId);

        if (error) {
          logStep("Error marking subscription as canceled", { error: error.message });
          captureException(error);
        }

        // Log billing event
        await supabase.from("billing_events").insert({
          organization_id: organizationId,
          event_type: "subscription_canceled",
          stripe_event_id: subscription.id,
          description: "Subscription was canceled",
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Get organization from subscription
        const { data: sub } = await supabase
          .from("organization_subscriptions")
          .select("organization_id")
          .eq("stripe_customer_id", invoice.customer as string)
          .maybeSingle();

        if (!sub?.organization_id) {
          logStep("No organization found for customer", { customerId: invoice.customer });
          break;
        }

        logStep("Invoice paid", { 
          organizationId: sub.organization_id, 
          amount: invoice.amount_paid 
        });

        // Upsert invoice record
        await supabase.from("organization_invoices").upsert({
          organization_id: sub.organization_id,
          stripe_invoice_id: invoice.id,
          stripe_customer_id: invoice.customer as string,
          amount_due: invoice.amount_due,
          amount_paid: invoice.amount_paid,
          currency: invoice.currency,
          status: "paid",
          invoice_pdf: invoice.invoice_pdf,
          hosted_invoice_url: invoice.hosted_invoice_url,
          period_start: invoice.period_start 
            ? new Date(invoice.period_start * 1000).toISOString() 
            : null,
          period_end: invoice.period_end 
            ? new Date(invoice.period_end * 1000).toISOString() 
            : null,
          paid_at: new Date().toISOString(),
          description: invoice.description,
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_invoice_id" });

        // Log billing event
        await supabase.from("billing_events").insert({
          organization_id: sub.organization_id,
          event_type: "invoice_paid",
          stripe_event_id: event.id,
          description: `Invoice paid`,
          amount: invoice.amount_paid,
          currency: invoice.currency,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        
        // Get organization from subscription
        const { data: sub } = await supabase
          .from("organization_subscriptions")
          .select("organization_id")
          .eq("stripe_customer_id", invoice.customer as string)
          .maybeSingle();

        if (!sub?.organization_id) {
          logStep("No organization found for customer", { customerId: invoice.customer });
          break;
        }

        logStep("Invoice payment failed", { 
          organizationId: sub.organization_id, 
          amount: invoice.amount_due 
        });

        // Update invoice record
        await supabase.from("organization_invoices").upsert({
          organization_id: sub.organization_id,
          stripe_invoice_id: invoice.id,
          stripe_customer_id: invoice.customer as string,
          amount_due: invoice.amount_due,
          amount_paid: invoice.amount_paid,
          currency: invoice.currency,
          status: "payment_failed",
          invoice_pdf: invoice.invoice_pdf,
          hosted_invoice_url: invoice.hosted_invoice_url,
          period_start: invoice.period_start 
            ? new Date(invoice.period_start * 1000).toISOString() 
            : null,
          period_end: invoice.period_end 
            ? new Date(invoice.period_end * 1000).toISOString() 
            : null,
          description: invoice.description,
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_invoice_id" });

        // Log billing event
        await supabase.from("billing_events").insert({
          organization_id: sub.organization_id,
          event_type: "payment_failed",
          stripe_event_id: event.id,
          description: "Payment failed for invoice",
          amount: invoice.amount_due,
          currency: invoice.currency,
        });

        // Update subscription status
        await supabase
          .from("organization_subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("organization_id", sub.organization_id);
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    await captureException(error instanceof Error ? error : new Error(errorMessage), {
      functionName: FUNCTION_NAME,
      request: req,
    });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
}));
