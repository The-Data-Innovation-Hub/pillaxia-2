/**
 * In-memory rate limiting utility for Azure Functions
 * Ported from Supabase Edge Functions (_shared/rateLimiter.ts)
 *
 * Sliding window algorithm with configurable limits per endpoint type.
 * Note: Per-instance limiting. For production scale use Redis (e.g. Azure Cache for Redis).
 */

export const RATE_LIMITS = {
  auth:      { windowMs: 60_000, maxRequests: 5 },
  sensitive: { windowMs: 60_000, maxRequests: 3 },
  api:       { windowMs: 60_000, maxRequests: 60 },
  ai:        { windowMs: 60_000, maxRequests: 10 },
  webhook:   { windowMs: 60_000, maxRequests: 100 },
};

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateLimitStore = new Map();

const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) rateLimitStore.delete(key);
  }
}

/**
 * Check and update rate limit for an identifier
 * @param {string} identifier
 * @param {keyof RATE_LIMITS} [endpointType='api']
 * @returns {{ allowed: boolean, remaining: number, resetAt: number, retryAfter?: number }}
 */
export function checkRateLimit(identifier, endpointType = 'api') {
  cleanupExpiredEntries();
  const config = RATE_LIMITS[endpointType] || RATE_LIMITS.api;
  const key = `${identifier}:${endpointType}`;
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + config.windowMs };
    rateLimitStore.set(key, entry);
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: entry.resetAt };
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, retryAfter };
  }

  entry.count++;
  rateLimitStore.set(key, entry);
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Extract client identifier from request
 * @param {import('@azure/functions').HttpRequest} req
 * @param {string} [userId]
 * @returns {string}
 */
export function getClientIdentifier(req, userId) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfIp = req.headers.get('cf-connecting-ip');
  const ip = cfIp || realIp || forwardedFor?.split(',')[0]?.trim() || 'unknown';
  return userId ? `${ip}:${userId}` : ip;
}

/**
 * Create rate limit headers for response
 * @param {{ remaining: number, resetAt: number, allowed: boolean, retryAfter?: number }} result
 * @returns {Record<string, string>}
 */
export function rateLimitHeaders(result) {
  const headers = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  };
  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }
  return headers;
}

/**
 * Create a 429 Too Many Requests response (Azure Functions format)
 * @param {{ retryAfter?: number, remaining: number, resetAt: number, allowed: boolean }} result
 * @param {Record<string, string>} corsHeaders
 * @returns {import('@azure/functions').HttpResponseInit}
 */
export function rateLimitExceededResponse(result, corsHeaders) {
  return {
    status: 429,
    headers: { ...corsHeaders, ...rateLimitHeaders(result), 'Content-Type': 'application/json' },
    jsonBody: {
      error: 'Too many requests',
      message: `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    },
  };
}

/**
 * Middleware-style rate limit check.
 * Returns null if allowed, or a 429 response if rate limited.
 * @param {import('@azure/functions').HttpRequest} req
 * @param {string} endpointType
 * @param {Record<string, string>} corsHeaders
 * @param {string} [userId]
 * @returns {import('@azure/functions').HttpResponseInit|null}
 */
export function withRateLimit(req, endpointType, corsHeaders, userId) {
  const identifier = getClientIdentifier(req, userId);
  const result = checkRateLimit(identifier, endpointType);
  if (!result.allowed) {
    console.log(`[RATE_LIMIT] Blocked ${identifier} on ${endpointType} - retry after ${result.retryAfter}s`);
    return rateLimitExceededResponse(result, corsHeaders);
  }
  return null;
}
