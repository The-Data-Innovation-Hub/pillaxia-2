/**
 * User notification preferences fetching utility
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export interface PatientNotificationPreferences {
  user_id: string;
  email_reminders: boolean;
  sms_reminders: boolean;
  whatsapp_reminders: boolean;
  in_app_reminders: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

/**
 * Fetch notification preferences for multiple users
 * @param supabase - Supabase client
 * @param userIds - Array of user IDs to fetch preferences for
 * @returns Map of user ID to their preferences
 */
export async function fetchUserPreferences(
  supabase: AnySupabaseClient,
  userIds: string[]
): Promise<Map<string, PatientNotificationPreferences>> {
  const preferencesMap = new Map<string, PatientNotificationPreferences>();

  if (userIds.length === 0) {
    return preferencesMap;
  }

  const { data: allPreferences, error } = await supabase
    .from("patient_notification_preferences")
    .select(`
      user_id,
      email_reminders,
      sms_reminders,
      whatsapp_reminders,
      in_app_reminders,
      quiet_hours_enabled,
      quiet_hours_start,
      quiet_hours_end
    `)
    .in("user_id", userIds);

  if (error) {
    console.error("Error fetching patient preferences:", error);
    return preferencesMap;
  }

  if (allPreferences) {
    for (const pref of allPreferences as PatientNotificationPreferences[]) {
      preferencesMap.set(pref.user_id, pref);
    }
  }

  return preferencesMap;
}

/**
 * Get default preferences for a user (all enabled, no quiet hours)
 */
export function getDefaultPreferences(userId: string): PatientNotificationPreferences {
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
