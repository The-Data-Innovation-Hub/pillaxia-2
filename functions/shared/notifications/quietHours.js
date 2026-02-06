/**
 * Quiet hours checking utility for notification scheduling
 * Ported from Supabase Edge Functions (_shared/notifications/quietHours.ts)
 */

/**
 * Check if the current time is within the user's quiet hours.
 * Handles overnight quiet hours (e.g., 22:00 to 07:00).
 *
 * @param {{ quiet_hours_enabled: boolean, quiet_hours_start: string|null, quiet_hours_end: string|null }} prefs
 * @param {Date} [currentTime]
 * @returns {boolean} true if notifications should be suppressed
 */
export function isInQuietHours(prefs, currentTime) {
  if (!prefs.quiet_hours_enabled || !prefs.quiet_hours_start || !prefs.quiet_hours_end) {
    return false;
  }

  const now = currentTime || new Date();
  const currentTimeStr = now.toTimeString().slice(0, 5); // HH:MM
  const start = prefs.quiet_hours_start.slice(0, 5);
  const end = prefs.quiet_hours_end.slice(0, 5);

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (start > end) {
    return currentTimeStr >= start || currentTimeStr < end;
  }

  return currentTimeStr >= start && currentTimeStr < end;
}
