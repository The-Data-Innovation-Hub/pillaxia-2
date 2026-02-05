# Pillaxia Azure Functions

Migrated from Supabase Edge Functions (Deno) to Azure Functions (Node.js).

## Migrated Functions

| Function | Trigger | Schedule/Endpoint | Status |
|----------|---------|-------------------|--------|
| send-medication-reminders | Timer | Every 5 min | Migrated |
| stripe-webhook | HTTP | POST /api/stripe-webhook | Migrated |

## To Migrate

Run adapt script and migrate remaining 48+ functions:

- send-push-notification, send-native-push (invoked by send-medication-reminders)
- send-sms-notification, send-whatsapp-notification
- send-email (Resend integration)
- check-missed-doses, check-refill-alerts, check-red-flag-symptoms
- resend-webhook, twilio-webhook
- clinical-decision-support, angela-chat
- calculate-engagement-scores, calculate-patient-risks
- etc.

## Migration Pattern

1. Replace `import { createClient } from "@supabase/supabase-js"` with `import { query } from "../shared/db.js"`
2. Replace `supabase.from("table").select(...)` with raw SQL via `query()`
3. Replace `supabase.functions.invoke("name", { body })` with HTTP fetch to Azure Function URL
4. Replace Deno.serve with Azure Functions handler
5. Add function to host.json bindings

## Environment Variables

Set in Azure Function App Settings or local.settings.json:

- DATABASE_URL
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- RESEND_API_KEY
- TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
- FUNCTIONS_BASE_URL (for internal function calls)
- FUNCTIONS_MASTER_KEY (for authenticated internal calls)
