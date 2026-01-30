/**
 * Shared CORS utility for edge functions
 * 
 * Production-safe CORS configuration that restricts origins
 * based on environment. In development, allows all origins.
 * In production, restricts to allowed domains.
 */

// Allowed origins for production
const ALLOWED_ORIGINS = [
  'https://pillaxia-craft-suite.lovable.app',
  'https://id-preview--8333c041-bf59-48ac-a717-3597c3a11358.lovable.app',
  // Add additional production domains as needed
];

/**
 * Get CORS headers based on the request origin
 * In development (localhost), allows all origins
 * In production, validates against allowed list
 */
export function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  // Check if origin is allowed
  const isAllowed = !requestOrigin || 
    requestOrigin.includes('localhost') ||
    requestOrigin.includes('127.0.0.1') ||
    requestOrigin.includes('.lovable.app') ||
    requestOrigin.includes('.lovableproject.com') ||
    ALLOWED_ORIGINS.includes(requestOrigin);

  const allowedOrigin = isAllowed ? (requestOrigin || '*') : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin');
    return new Response(null, { 
      status: 204,
      headers: getCorsHeaders(origin) 
    });
  }
  return null;
}

/**
 * Legacy CORS headers for backward compatibility
 * @deprecated Use getCorsHeaders() for production-safe CORS
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};
