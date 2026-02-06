/**
 * Unified database client – Azure API client.
 *
 * Usage:
 *   import { db } from '@/integrations/db';
 *   const { data } = await db.from('medications').select('*').eq('user_id', uid);
 *
 * For RPC calls:
 *   await db.rpc('log_security_event', { ... });
 */

import { apiClient } from '@/integrations/api/client';

/**
 * The primary database client (Azure Express API).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = apiClient;
