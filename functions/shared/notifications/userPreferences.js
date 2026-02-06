/**
 * User notification preferences fetching utility
 * Ported from Supabase Edge Functions (_shared/notifications/userPreferences.ts)
 *
 * Uses shared PostgreSQL client instead of Supabase client.
 */

import { query } from '../db.js';

/**
 * Fetch notification preferences for multiple users
 * @param {string[]} userIds
 * @returns {Promise<Map<string, object>>}
 */
export async function fetchUserPreferences(userIds) {
  const preferencesMap = new Map();
  if (userIds.length === 0) return preferencesMap;

  const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
  const res = await query(
    `SELECT user_id, email_reminders, sms_reminders, whatsapp_reminders,
            in_app_reminders, quiet_hours_enabled, quiet_hours_start, quiet_hours_end
     FROM patient_notification_preferences
     WHERE user_id IN (${placeholders})`,
    userIds,
  );

  for (const pref of res.rows) {
    preferencesMap.set(pref.user_id, pref);
  }

  return preferencesMap;
}

/**
 * Get default preferences for a user (all enabled, no quiet hours)
 * @param {string} userId
 * @returns {{ user_id: string, email_reminders: boolean, sms_reminders: boolean, whatsapp_reminders: boolean, in_app_reminders: boolean, quiet_hours_enabled: boolean, quiet_hours_start: null, quiet_hours_end: null }}
 */
export function getDefaultPreferences(userId) {
  return {
    user_id: userId,
    email_reminders: true,
    sms_reminders: true,
    whatsapp_reminders: true,
    in_app_reminders: true,
    quiet_hours_enabled: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
  };
}
