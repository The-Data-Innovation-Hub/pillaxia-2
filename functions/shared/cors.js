/**
 * Shared CORS utility for Azure Functions
 * Ported from Supabase Edge Functions (_shared/cors.ts)
 *
 * Production-safe CORS configuration that restricts origins
 * based on environment. In development, allows all origins.
 */

const ALLOWED_ORIGINS = [
  'https://pillaxia-craft-suite.lovable.app',
  'https://id-preview--8333c041-bf59-48ac-a717-3597c3a11358.lovable.app',
  // Add additional production domains as needed
];

/**
 * Get CORS headers based on the request origin
 * @param {string|null} requestOrigin
 * @returns {Record<string, string>}
 */
export function getCorsHeaders(requestOrigin) {
  const isAllowed =
    !requestOrigin ||
    requestOrigin.includes('localhost') ||
    requestOrigin.includes('127.0.0.1') ||
    requestOrigin.includes('.lovable.app') ||
    requestOrigin.includes('.lovableproject.com') ||
    ALLOWED_ORIGINS.includes(requestOrigin);

  const allowedOrigin = isAllowed ? requestOrigin || '*' : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-functions-key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight for Azure Functions HttpRequest
 * @param {import('@azure/functions').HttpRequest} req
 * @returns {import('@azure/functions').HttpResponseInit|null}
 */
export function handleCorsPreflightRequest(req) {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin');
    return {
      status: 204,
      headers: getCorsHeaders(origin),
    };
  }
  return null;
}

/** @deprecated Use getCorsHeaders() for production-safe CORS */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-functions-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};
