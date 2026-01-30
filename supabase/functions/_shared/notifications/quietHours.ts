/**
 * Quiet hours checking utility for notification scheduling
 */

export interface QuietHoursSettings {
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

/**
 * Check if the current time is within the user's quiet hours
 * Handles overnight quiet hours (e.g., 22:00 to 07:00)
 * 
 * @param prefs - User's quiet hours preferences
 * @param currentTime - Optional override for current time (for testing)
 * @returns true if notifications should be suppressed
 */
export function isInQuietHours(
  prefs: QuietHoursSettings,
  currentTime?: Date
): boolean {
  if (!prefs.quiet_hours_enabled || !prefs.quiet_hours_start || !prefs.quiet_hours_end) {
    return false;
  }

  const now = currentTime || new Date();
  const currentTimeStr = now.toTimeString().slice(0, 5); // HH:MM format
  const start = prefs.quiet_hours_start.slice(0, 5);
  const end = prefs.quiet_hours_end.slice(0, 5);

  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (start > end) {
    return currentTimeStr >= start || currentTimeStr < end;
  }

  return currentTimeStr >= start && currentTimeStr < end;
}
