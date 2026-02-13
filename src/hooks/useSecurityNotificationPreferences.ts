import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSecurityNotificationPreferences,
  upsertSecurityNotificationPreferences,
} from "@/integrations/azure/data";

export interface SecurityNotificationPreferences {
  id: string;
  user_id: string;
  notify_account_locked: boolean;
  notify_account_unlocked: boolean;
  notify_password_change: boolean;
  notify_password_reset: boolean;
  notify_suspicious_activity: boolean;
  notify_new_device_login: boolean;
  notify_concurrent_session_blocked: boolean;
  notify_mfa_enabled: boolean;
  notify_mfa_disabled: boolean;
  notify_data_export: boolean;
  notify_permission_change: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PREFERENCES: Omit<
  SecurityNotificationPreferences,
  "id" | "user_id" | "created_at" | "updated_at"
> = {
  notify_account_locked: true,
  notify_account_unlocked: true,
  notify_password_change: true,
  notify_password_reset: true,
  notify_suspicious_activity: true,
  notify_new_device_login: true,
  notify_concurrent_session_blocked: true,
  notify_mfa_enabled: true,
  notify_mfa_disabled: true,
  notify_data_export: true,
  notify_permission_change: true,
  email_enabled: true,
  push_enabled: false,
};

export function useSecurityNotificationPreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: preferences, isLoading, error } = useQuery({
    queryKey: ["security-notification-preferences", user?.id],
    queryFn: async (): Promise<SecurityNotificationPreferences> => {
      if (!user?.id) throw new Error("User not authenticated");

      const data = await getSecurityNotificationPreferences(user.id);

      if (!data) {
        const created = await upsertSecurityNotificationPreferences(user.id, DEFAULT_PREFERENCES);
        return created as SecurityNotificationPreferences;
      }

      return data as SecurityNotificationPreferences;
    },
    enabled: !!user?.id,
  });

  const updatePreferences = useMutation({
    mutationFn: async (
      updates: Partial<
        Omit<SecurityNotificationPreferences, "id" | "user_id" | "created_at" | "updated_at">
      >
    ) => {
      if (!user?.id) throw new Error("User not authenticated");
      await upsertSecurityNotificationPreferences(user.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["security-notification-preferences", user?.id],
      });
      toast.success("Security notification preferences updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update preferences", { description: error.message });
    },
  });

  const togglePreference = (
    key: keyof Omit<
      SecurityNotificationPreferences,
      "id" | "user_id" | "created_at" | "updated_at"
    >
  ) => {
    if (!preferences) return;
    updatePreferences.mutate({ [key]: !preferences[key] });
  };

  return {
    preferences,
    isLoading,
    error,
    updatePreferences,
    togglePreference,
    isUpdating: updatePreferences.isPending,
  };
}
