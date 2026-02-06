/**
 * HTTP API Endpoint Functions
 * Ported from Supabase Edge Functions to Azure Functions v4
 */

import { app } from '@azure/functions';
import { query } from '../shared/db.js';
import { getUserFromRequest, unauthorizedResponse, getUserRoles, isAdmin } from '../shared/auth.js';
import { getCorsHeaders, handleCorsPreflightRequest } from '../shared/cors.js';
import { captureException, captureMessage, withSentry } from '../shared/sentry.js';
import { withRateLimit } from '../shared/rateLimiter.js';
import { validateSchema, validationErrorResponse, validators } from '../shared/validation.js';
import { escapeHtml } from '../shared/email/escapeHtml.js';

// ============= Angela Chat =============

const ANGELA_SYSTEM_PROMPT = `You are Angela, a warm and caring AI health companion for Pillaxia, a medication management platform. Your personality is:
- Compassionate, patient, and supportive
- Professional but approachable - like a knowledgeable friend
- Use encouraging language and celebrate small wins
- Acknowledge challenges patients face with medication adherence

Your expertise includes:
- Medication guidance (timing, food interactions, common side effects)
- General health and wellness advice
- Supporting medication adherence with practical tips
- Answering questions about prescription management

Important guidelines:
- NEVER diagnose conditions or recommend specific medications
- Always recommend consulting healthcare providers for medical decisions
- If asked about serious symptoms, encourage immediate medical attention
- Keep responses concise but helpful (2-4 paragraphs max)
- Use emojis sparingly to add warmth (💜, ✨, 💪)
- Remember you're supporting patients, not replacing their doctors`;

app.http('angela-chat', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req, context) => {
    if (req.method === 'OPTIONS') return { status: 204, headers: getCorsHeaders(req.headers.get('Origin')) };
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse('Please log in to chat with Angela'), headers: corsH };

    try {
      const { messages } = await req.json();
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'system', content: ANGELA_SYSTEM_PROMPT }, ...messages],
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 429) return { status: 429, headers: corsH, jsonBody: { error: "I'm getting a lot of questions right now! Please try again in a moment. 💜" } };
        if (response.status === 402) return { status: 402, headers: corsH, jsonBody: { error: 'The AI service needs attention. Please contact support.' } };
        return { status: 500, headers: corsH, jsonBody: { error: "I'm having trouble connecting right now. Please try again." } };
      }

      return { status: 200, headers: { ...corsH, 'Content-Type': 'text/event-stream' }, body: response.body };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)), { functionName: 'angela-chat' });
      return { status: 500, headers: corsH, jsonBody: { error: e instanceof Error ? e.message : 'Something went wrong.' } };
    }
  },
});

// ============= Clinical Decision Support =============

const CDS_SYSTEM_PROMPT = `You are a Clinical Decision Support AI assistant integrated into Pillaxia, a healthcare platform. You assist clinicians by analyzing patient data and providing evidence-based insights.

**Your Role:**
- Analyze symptoms, vitals, lab results, medications, and health history
- Suggest possible diagnoses based on clinical presentation
- Recommend evidence-based treatment options
- Flag potential drug interactions and contraindications
- Identify red flags requiring urgent attention

**Critical Guidelines:**
- Always state that these are AI-generated suggestions requiring clinical judgment
- Never provide definitive diagnoses - always phrase as "Consider..." or "Possible..."
- Highlight any critical findings that need immediate attention
- Reference relevant clinical guidelines when applicable

Always end with a reminder that clinical judgment should guide final decisions.`;

app.http('clinical-decision-support', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req, context) => {
    if (req.method === 'OPTIONS') return { status: 204, headers: getCorsHeaders(req.headers.get('Origin')) };
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const body = await req.json();
      const { patientContext, conversationHistory } = body;
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

      let contextMessage = '## Patient Information\n\n';
      if (patientContext?.symptoms?.length) {
        contextMessage += '### Current Symptoms\n';
        patientContext.symptoms.forEach((s) => { contextMessage += `- **${s.name}**: Severity ${s.severity}/10\n`; });
        contextMessage += '\n';
      }
      if (patientContext?.clinicalQuestion) contextMessage += `### Clinical Question\n${patientContext.clinicalQuestion}\n`;
      else contextMessage += '### Request\nPlease provide a comprehensive clinical decision support analysis.\n';

      const messages = [...(conversationHistory || []), { role: 'user', content: contextMessage }];
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'google/gemini-3-flash-preview', messages: [{ role: 'system', content: CDS_SYSTEM_PROMPT }, ...messages], stream: true }),
      });

      if (!response.ok) {
        if (response.status === 429) return { status: 429, headers: corsH, jsonBody: { error: 'AI service busy. Try again.' } };
        return { status: 500, headers: corsH, jsonBody: { error: 'Failed to connect to AI service.' } };
      }

      return { status: 200, headers: { ...corsH, 'Content-Type': 'text/event-stream' }, body: response.body };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)), { functionName: 'clinical-decision-support' });
      return { status: 500, headers: corsH, jsonBody: { error: e instanceof Error ? e.message : 'An error occurred' } };
    }
  },
});

// ============= Extract Medication OCR =============

app.http('extract-medication-ocr', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const { image } = await req.json();
      if (!image) return { status: 400, headers: corsH, jsonBody: { error: 'No image provided' } };
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a medical prescription analyzer. Extract medication information from prescription labels or medication boxes. Return a JSON object with a "medications" array.' },
            { role: 'user', content: [{ type: 'text', text: 'Please analyze this prescription image.' }, { type: 'image_url', image_url: { url: image } }] },
          ],
          tools: [{ type: 'function', function: { name: 'extract_medications', parameters: { type: 'object', properties: { medications: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, dosage: { type: 'string' }, dosage_unit: { type: 'string' }, form: { type: 'string' }, instructions: { type: 'string' }, confidence: { type: 'number' } }, required: ['name', 'dosage', 'dosage_unit', 'form', 'confidence'] } } }, required: ['medications'] } } }],
          tool_choice: { type: 'function', function: { name: 'extract_medications' } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return { status: 429, headers: corsH, jsonBody: { error: 'Rate limit exceeded.' } };
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const aiResponse = await response.json();
      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
      const medications = toolCall ? JSON.parse(toolCall.function.arguments).medications || [] : [];
      return { status: 200, headers: corsH, jsonBody: { medications } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: e instanceof Error ? e.message : 'Unknown error' } };
    }
  },
});

// ============= Get Sentry DSN =============

app.http('get-sentry-dsn', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const dsn = (process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || '').trim();
    return { status: 200, headers: corsH, jsonBody: { dsn: dsn || null } };
  },
});

// ============= Get VAPID Public Key =============

app.http('get-vapid-public-key', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) return { status: 500, headers: corsH, jsonBody: { error: 'VAPID_PUBLIC_KEY not set' } };
    return { status: 200, headers: corsH, jsonBody: { publicKey } };
  },
});

// ============= Check Password Breach (HIBP) =============

app.http('check-password-breach', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const { password } = await req.json();
      if (!password || typeof password !== 'string') return { status: 400, headers: corsH, jsonBody: { error: 'Password required' } };

      const { createHash } = await import('node:crypto');
      const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'User-Agent': 'Pillaxia-Healthcare-Platform', 'Add-Padding': 'true' },
      });

      if (!response.ok) return { status: 200, headers: corsH, jsonBody: { breached: false, count: 0, apiError: true } };

      const text = await response.text();
      let breachCount = 0;
      for (const line of text.split('\n')) {
        const [hashSuffix, count] = line.split(':');
        if (hashSuffix.trim().toUpperCase() === suffix) { breachCount = parseInt(count.trim(), 10); break; }
      }

      return { status: 200, headers: corsH, jsonBody: { breached: breachCount > 0, count: breachCount, message: breachCount > 0 ? `This password has been exposed in ${breachCount.toLocaleString()} data breaches.` : 'Password not found in known breaches' } };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to check password', breached: false } };
    }
  },
});

// ============= Get IP Geolocation =============

app.http('get-ip-geolocation', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const body = await req.json();
      const { ip_address, user_agent, action = 'login' } = body;
      const clientIp = ip_address || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';

      let geoData = {};
      if (clientIp && clientIp !== 'unknown' && !clientIp.startsWith('127.') && !clientIp.startsWith('192.168.')) {
        try {
          const geoResponse = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp`);
          const geoJson = await geoResponse.json();
          if (geoJson.status === 'success') geoData = geoJson;
        } catch { /* ignore geo errors */ }
      }

      const { rows: existingLocations } = await query('SELECT id, city, country_code, is_trusted FROM user_login_locations WHERE user_id = $1', [user.userId]);
      const isNewLocation = !existingLocations.some((loc) => loc.city === geoData.city && loc.country_code === geoData.countryCode);
      const isNewCountry = !existingLocations.some((loc) => loc.country_code === geoData.countryCode);

      await query(
        `INSERT INTO user_login_locations (user_id, ip_address, city, region, country, country_code, latitude, longitude, timezone, isp, user_agent, is_trusted, action)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [user.userId, clientIp, geoData.city || 'Unknown', geoData.regionName || 'Unknown', geoData.country || 'Unknown', geoData.countryCode || 'XX', geoData.lat || null, geoData.lon || null, geoData.timezone || null, geoData.isp || null, user_agent || null, !isNewLocation, action],
      );

      return { status: 200, headers: corsH, jsonBody: { success: true, location: { city: geoData.city, region: geoData.regionName, country: geoData.country, countryCode: geoData.countryCode }, isNewLocation, isNewCountry, isTrusted: !isNewLocation } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Internal server error' } };
    }
  },
});

// ============= Check Org Subscription =============

app.http('check-org-subscription', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const body = await req.json().catch(() => ({}));
      const { organizationId } = body;
      if (!organizationId) return { status: 400, headers: corsH, jsonBody: { error: 'organizationId required' } };

      const { rows: subs } = await query('SELECT * FROM organization_subscriptions WHERE organization_id = $1 LIMIT 1', [organizationId]);
      if (subs.length === 0) return { status: 200, headers: corsH, jsonBody: { subscribed: false, tier: null, seats_purchased: 0, seats_used: 0 } };

      const sub = subs[0];
      const { rows: countRows } = await query('SELECT COUNT(*) as cnt FROM organization_members WHERE organization_id = $1 AND is_active = true', [organizationId]);
      const seatsUsed = parseInt(countRows[0]?.cnt || '0', 10);
      const isActive = ['active', 'trialing'].includes(sub.status);

      return { status: 200, headers: corsH, jsonBody: { subscribed: isActive, status: sub.status, seats_purchased: sub.seats_purchased, seats_used: seatsUsed, subscription_end: sub.current_period_end } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: e instanceof Error ? e.message : 'Error' } };
    }
  },
});

// ============= Create Org Checkout =============

app.http('create-org-checkout', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not set');
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey);

      const body = await req.json();
      const { organizationId, tier, seats } = body;

      const PRICING_TIERS = {
        starter: { priceId: 'price_1SubmFRzXjja5wsGVBObpv52', seats: 10 },
        professional: { priceId: 'price_1SubmmRzXjja5wsGywesczVP', seats: 50 },
        enterprise: { priceId: 'price_1SubgARzXjja5wsGvBKZNMax', seats: 500 },
      };

      const selectedTier = PRICING_TIERS[tier];
      if (!selectedTier) return { status: 400, headers: corsH, jsonBody: { error: 'Invalid tier' } };

      // Check membership
      const { rows: memberships } = await query(
        'SELECT org_role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true LIMIT 1',
        [organizationId, user.userId],
      );
      if (memberships.length === 0 || !['admin', 'owner'].includes(memberships[0].org_role)) {
        return { status: 403, headers: corsH, jsonBody: { error: 'Only org admins can manage billing' } };
      }

      const { rows: existingSubs } = await query('SELECT stripe_customer_id FROM organization_subscriptions WHERE organization_id = $1 LIMIT 1', [organizationId]);
      const customerId = existingSubs[0]?.stripe_customer_id || undefined;

      const { rows: orgs } = await query('SELECT contact_email FROM organizations WHERE id = $1', [organizationId]);
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : orgs[0]?.contact_email,
        line_items: [{ price: selectedTier.priceId, quantity: seats || 1 }],
        mode: 'subscription',
        success_url: `${req.headers.get('origin')}/dashboard/organization?billing=success`,
        cancel_url: `${req.headers.get('origin')}/dashboard/organization?billing=canceled`,
        metadata: { organization_id: organizationId, tier, seats: String(seats || selectedTier.seats) },
        subscription_data: { metadata: { organization_id: organizationId, tier } },
        allow_promotion_codes: true,
      });

      return { status: 200, headers: corsH, jsonBody: { url: session.url } };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: e instanceof Error ? e.message : 'Error' } };
    }
  },
});

// ============= Org Customer Portal =============

app.http('org-customer-portal', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeKey);

      const { organizationId } = await req.json();
      const { rows: memberships } = await query('SELECT org_role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND is_active = true LIMIT 1', [organizationId, user.userId]);
      if (memberships.length === 0 || !['admin', 'owner'].includes(memberships[0].org_role)) return { status: 403, headers: corsH, jsonBody: { error: 'Only org admins can access billing portal' } };

      const { rows: subs } = await query('SELECT stripe_customer_id FROM organization_subscriptions WHERE organization_id = $1 LIMIT 1', [organizationId]);
      if (!subs[0]?.stripe_customer_id) return { status: 404, headers: corsH, jsonBody: { error: 'No billing account found' } };

      const origin = req.headers.get('origin') || 'https://pillaxia-craft-suite.lovable.app';
      const portalSession = await stripe.billingPortal.sessions.create({ customer: subs[0].stripe_customer_id, return_url: `${origin}/dashboard/organization?tab=billing` });
      return { status: 200, headers: corsH, jsonBody: { url: portalSession.url } };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: 'An error occurred' } };
    }
  },
});

// ============= Validate Session =============

app.http('validate-session', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    const rateLimitResp = withRateLimit(req, 'auth', corsH);
    if (rateLimitResp) return rateLimitResp;

    const user = getUserFromRequest(req);
    if (!user) return { status: 401, headers: corsH, jsonBody: { valid: false, reason: 'Invalid or expired token' } };

    try {
      const roles = await getUserRoles(user.userId);
      const roleFlags = {
        isAdmin: roles.includes('admin'),
        isManager: roles.includes('manager'),
        isClinician: roles.includes('clinician'),
        isPharmacist: roles.includes('pharmacist'),
        isPatient: roles.includes('patient'),
      };

      // Get session settings
      const { rows: settings } = await query("SELECT setting_key, setting_value FROM security_settings WHERE setting_key IN ('session_timeout_minutes', 'max_concurrent_sessions')");
      const sessionTimeoutMinutes = settings.find((s) => s.setting_key === 'session_timeout_minutes')?.setting_value?.value || 30;

      // Check/create session
      const { rows: sessions } = await query(
        'SELECT id, last_activity, expires_at FROM user_sessions WHERE user_id = $1 AND is_active = true ORDER BY last_activity DESC LIMIT 1',
        [user.userId],
      );

      const now = new Date();
      if (sessions.length > 0) {
        const session = sessions[0];
        const lastActivity = new Date(session.last_activity);
        const idleMinutes = Math.floor((now.getTime() - lastActivity.getTime()) / 60000);
        if (idleMinutes > sessionTimeoutMinutes) {
          await query('UPDATE user_sessions SET is_active = false WHERE id = $1', [session.id]);
          return { status: 401, headers: corsH, jsonBody: { valid: false, reason: 'Session timed out' } };
        }
        await query('UPDATE user_sessions SET last_activity = $1 WHERE id = $2', [now.toISOString(), session.id]);
        return { status: 200, headers: corsH, jsonBody: { valid: true, userId: user.userId, sessionId: session.id, remainingMinutes: sessionTimeoutMinutes - idleMinutes, roles, ...roleFlags } };
      }

      // Create new session
      const expiresAt = new Date(now.getTime() + sessionTimeoutMinutes * 60 * 1000);
      const { rows: newSessions } = await query(
        'INSERT INTO user_sessions (user_id, last_activity, expires_at, is_active, ip_address, user_agent) VALUES ($1, $2, $3, true, $4, $5) RETURNING id',
        [user.userId, now.toISOString(), expiresAt.toISOString(), req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(), req.headers.get('user-agent')],
      );

      return { status: 200, headers: corsH, jsonBody: { valid: true, userId: user.userId, sessionId: newSessions[0]?.id, remainingMinutes: sessionTimeoutMinutes, roles, ...roleFlags } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { valid: false, reason: 'Session validation failed' } };
    }
  },
});

// ============= Seed Demo Users (Admin Only) =============

app.http('seed-demo-users', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };
    if (!(await isAdmin(user.userId))) return { status: 403, headers: corsH, jsonBody: { error: 'Admin access required' } };

    // Seed demo users is now handled through the Azure AD B2C admin panel
    return { status: 200, headers: corsH, jsonBody: { success: true, message: 'Demo user seeding is handled through Azure AD B2C admin portal. Please use the Azure portal to create test users.' } };
  },
});

// ============= Email Click Tracker =============

app.http('email-click-tracker', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    if (req.method === 'OPTIONS') return { status: 204, headers: getCorsHeaders(req.headers.get('Origin')) };
    const DEFAULT_REDIRECT = 'https://pillaxia.com';

    try {
      const url = new URL(req.url);
      const notificationId = url.searchParams.get('id');
      const userId = url.searchParams.get('uid');
      const targetUrl = url.searchParams.get('url');

      let redirectTo = DEFAULT_REDIRECT;
      if (targetUrl) {
        try {
          const decoded = decodeURIComponent(targetUrl);
          if (decoded.startsWith('https://') && (decoded.includes('pillaxia') || decoded.includes('lovable'))) redirectTo = decoded;
        } catch { /* use default */ }
      }

      if (notificationId && userId) {
        await query("UPDATE notification_history SET clicked_at = NOW(), status = 'clicked' WHERE id = $1 AND user_id = $2 AND clicked_at IS NULL", [notificationId, userId]).catch(() => {});
      }

      return { status: 302, headers: { Location: redirectTo, 'Cache-Control': 'no-store' } };
    } catch {
      return { status: 302, headers: { Location: DEFAULT_REDIRECT } };
    }
  },
});

// ============= Email Tracking Pixel =============

const TRACKING_PIXEL = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
const PIXEL_HEADERS = { 'Content-Type': 'image/gif', 'Content-Length': String(TRACKING_PIXEL.length), 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' };

app.http('email-tracking-pixel', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async (req) => {
    try {
      const url = new URL(req.url);
      const notificationId = url.searchParams.get('id');
      const userId = url.searchParams.get('uid');
      if (notificationId && userId) {
        query("UPDATE notification_history SET opened_at = NOW(), status = 'opened' WHERE id = $1 AND user_id = $2 AND opened_at IS NULL", [notificationId, userId]).catch(() => {});
      }
    } catch { /* fire and forget */ }
    return { status: 200, headers: PIXEL_HEADERS, body: TRACKING_PIXEL };
  },
});

// ============= FHIR API (Capability Statement only for now) =============

app.http('fhir-api', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'fhir-api/{*path}',
  handler: async (req) => {
    const corsH = { ...getCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/fhir+json' };
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const fhirPath = pathParts.slice(pathParts.indexOf('fhir-api') + 1);
    const resourceType = fhirPath[0];

    // For now expose metadata/capability statement
    if (resourceType === 'metadata' || !resourceType) {
      return {
        status: 200,
        headers: corsH,
        jsonBody: {
          resourceType: 'CapabilityStatement',
          status: 'active',
          date: new Date().toISOString(),
          kind: 'instance',
          fhirVersion: '4.0.1',
          format: ['json'],
          rest: [{ mode: 'server', resource: [
            { type: 'Patient', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'MedicationRequest', interaction: [{ code: 'read' }, { code: 'search-type' }] },
            { type: 'MedicationAdministration', interaction: [{ code: 'search-type' }] },
            { type: 'AllergyIntolerance', interaction: [{ code: 'search-type' }] },
            { type: 'Condition', interaction: [{ code: 'search-type' }] },
          ] }],
        },
      };
    }

    const user = getUserFromRequest(req);
    if (!user) return { status: 401, headers: corsH, jsonBody: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'security', diagnostics: 'Authorization required' }] } };

    // TODO: Full FHIR resource handlers to be implemented
    return { status: 400, headers: corsH, jsonBody: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'not-supported', diagnostics: `Resource type '${resourceType}' handler pending migration` }] } };
  },
});
