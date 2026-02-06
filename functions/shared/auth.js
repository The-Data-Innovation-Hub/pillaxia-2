/**
 * Auth helpers for Azure Functions
 * Validates Bearer tokens (Azure AD B2C / MSAL JWTs) and extracts user info.
 */

import { query } from './db.js';

/**
 * Decode a JWT payload without signature verification.
 * Signature verification should be handled at the infrastructure layer
 * (Azure API Management, Azure AD, or the Express API proxy).
 * @param {string} token
 * @returns {{ sub?: string, iss?: string, aud?: string, exp?: number, [key: string]: unknown } | null}
 */
export function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract and validate user from Authorization header.
 * @param {import('@azure/functions').HttpRequest} req
 * @returns {{ userId: string, claims: object } | null}
 */
export function getUserFromRequest(req) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const claims = decodeJwt(token);
  if (!claims?.sub) return null;
  // Azure AD B2C uses 'sub' or 'oid' for user ID
  return { userId: claims.sub || claims.oid, claims };
}

/**
 * Fetch server-verified roles for a user.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function getUserRoles(userId) {
  const res = await query('SELECT role FROM user_roles WHERE user_id = $1', [userId]);
  return res.rows.map((r) => r.role);
}

/**
 * Check if user is admin.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isAdmin(userId) {
  const roles = await getUserRoles(userId);
  return roles.includes('admin');
}

/**
 * Build a 401 Unauthorized response.
 * @param {string} [message='Unauthorized']
 * @returns {import('@azure/functions').HttpResponseInit}
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return { status: 401, jsonBody: { error: message } };
}

/**
 * Build a 403 Forbidden response.
 * @param {string} [message='Forbidden']
 * @returns {import('@azure/functions').HttpResponseInit}
 */
export function forbiddenResponse(message = 'Forbidden') {
  return { status: 403, jsonBody: { error: message } };
}

/**
 * Call another Azure Function internally.
 * @param {string} name - function route name
 * @param {object} body - JSON body
 * @returns {Promise<object>}
 */
export async function invokeFunction(name, body) {
  const baseUrl = process.env.FUNCTIONS_BASE_URL || 'http://localhost:7071';
  const key = process.env.FUNCTIONS_MASTER_KEY;
  const url = `${baseUrl}/api/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key && { 'x-functions-key': key }),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Function ${name} failed (${res.status}): ${text}`);
  }
  return res.json();
}
