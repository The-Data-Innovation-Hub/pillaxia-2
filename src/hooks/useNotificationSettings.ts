import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { listNotificationSettings, updateNotificationSetting } from "@/integrations/azure/data";

export interface NotificationSetting {
  id: string;
  setting_key: string;
  is_enabled: boolean;
  description: string | null;
  updated_at: string;
}

export type NotificationSettingKey =
  | "medication_reminders"
  | "missed_dose_alerts"
  | "encouragement_messages";

export function useNotificationSettings() {
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: async (): Promise<NotificationSetting[]> => {
      const data = await listNotificationSettings();
      return (data || []).sort((a, b) =>
        String(a.setting_key).localeCompare(String(b.setting_key))
      ) as NotificationSetting[];
    },
    enabled: isAdmin,
  });

  const updateSetting = useMutation({
    mutationFn: async ({
      settingKey,
      isEnabled,
    }: {
      settingKey: NotificationSettingKey;
      isEnabled: boolean;
    }) => {
      await updateNotificationSetting(settingKey, {
        is_enabled: isEnabled,
        updated_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      toast.success("Notification setting updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update setting", { description: error.message });
    },
  });

  const isEnabled = (key: NotificationSettingKey): boolean => {
    const setting = settings?.find((s) => s.setting_key === key);
    return setting?.is_enabled ?? true;
  };

  const getSetting = (key: NotificationSettingKey): NotificationSetting | undefined => {
    return settings?.find((s) => s.setting_key === key);
  };

  return {
    settings,
    isLoading,
    error,
    updateSetting,
    isEnabled,
    getSetting,
    isUpdating: updateSetting.isPending,
  };
}
