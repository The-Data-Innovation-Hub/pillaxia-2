/**
 * Stripe Webhook - Azure Function (HTTP)
 * Migrated from Supabase Edge Function
 * Handles: subscription updates, invoice paid, payment failures
 */

import { app } from '@azure/functions';
import Stripe from 'stripe';
import { query } from '../shared/db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-06-20' });

app.http('stripe-webhook', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (req, context) => {
    const sig = req.headers.get('stripe-signature') || '';
    const body = await req.text();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      context.log.error('STRIPE_WEBHOOK_SECRET not configured');
      return { status: 400, body: 'Webhook secret not configured' };
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      context.log.error('Stripe webhook signature verification failed:', err.message);
      return { status: 400, body: `Webhook Error: ${err.message}` };
    }

    try {
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          await query(
            `UPDATE organization_subscriptions
             SET status = $1, stripe_subscription_id = $2,
                 current_period_start = $3, current_period_end = $4,
                 updated_at = now()
             WHERE stripe_subscription_id = $2`,
            [
              subscription.status,
              subscription.id,
              subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000)
                : null,
              subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
            ]
          );
          break;
        }
        case 'invoice.paid': {
          const invoice = event.data.object;
          await query(
            `INSERT INTO organization_invoices (organization_id, stripe_invoice_id, amount_paid, status, paid_at)
             SELECT organization_id, $1, $2, 'paid', $3
             FROM organization_subscriptions WHERE stripe_customer_id = $4
             ON CONFLICT (stripe_invoice_id) DO UPDATE SET amount_paid = $2, status = 'paid', paid_at = $3`,
            [invoice.id, invoice.amount_paid, new Date(), invoice.customer]
          );
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          context.log.warn('Payment failed for invoice:', invoice.id);
          break;
        }
        default:
          context.log(`Unhandled event type: ${event.type}`);
      }

      return { status: 200, body: JSON.stringify({ received: true }) };
    } catch (err) {
      context.log.error('Stripe webhook handler error:', err);
      return { status: 500, body: JSON.stringify({ error: err.message }) };
    }
  },
});
