/**
 * In-memory rate limiting utility for Edge Functions
 * 
 * Uses a sliding window algorithm with configurable limits per endpoint type.
 * Note: In a distributed environment, this provides per-instance limiting.
 * For production at scale, consider Redis-based limiting via Upstash.
 */

// Rate limit configurations by endpoint type
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Authentication endpoints - stricter limits to prevent brute force
  auth: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 5,          // 5 requests per minute
  },
  // Sensitive operations (password reset, MFA, etc.)
  sensitive: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 3,          // 3 requests per minute
  },
  // Standard API endpoints
  api: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 60,         // 60 requests per minute
  },
  // AI/compute-intensive endpoints
  ai: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 10,         // 10 requests per minute
  },
  // Webhook endpoints (higher limits for external services)
  webhook: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 100,        // 100 requests per minute
  },
};

// In-memory store for rate limiting
// Key format: `${identifier}:${endpoint}`
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  
  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number; // Seconds until reset (only if not allowed)
}

/**
 * Check and update rate limit for an identifier
 * @param identifier - Unique identifier (IP, user ID, or combination)
 * @param endpointType - Type of endpoint for limit selection
 * @returns Rate limit check result
 */
export function checkRateLimit(
  identifier: string,
  endpointType: keyof typeof RATE_LIMITS = 'api'
): RateLimitResult {
  cleanupExpiredEntries();
  
  const config = RATE_LIMITS[endpointType] || RATE_LIMITS.api;
  const key = `${identifier}:${endpointType}`;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // Create new entry if none exists or window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: entry.resetAt,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter,
    };
  }
  
  // Increment counter
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Extract client identifier from request
 * Uses IP address with optional user ID for authenticated requests
 */
export function getClientIdentifier(req: Request, userId?: string): string {
  // Try to get real IP from various headers
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  const ip = cfConnectingIp || realIp || forwardedFor?.split(',')[0]?.trim() || 'unknown';
  
  // Combine IP and user ID for more precise limiting
  if (userId) {
    return `${ip}:${userId}`;
  }
  
  return ip;
}

/**
 * Create rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
  };
  
  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }
  
  return headers;
}

/**
 * Create a 429 Too Many Requests response
 */
export function rateLimitExceededResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`,
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...rateLimitHeaders(result),
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Middleware-style rate limit check
 * Returns null if allowed, or a 429 Response if rate limited
 */
export function withRateLimit(
  req: Request,
  endpointType: keyof typeof RATE_LIMITS,
  corsHeaders: Record<string, string>,
  userId?: string
): Response | null {
  const identifier = getClientIdentifier(req, userId);
  const result = checkRateLimit(identifier, endpointType);
  
  if (!result.allowed) {
    console.log(`[RATE_LIMIT] Blocked ${identifier} on ${endpointType} - retry after ${result.retryAfter}s`);
    return rateLimitExceededResponse(result, corsHeaders);
  }
  
  return null;
}
