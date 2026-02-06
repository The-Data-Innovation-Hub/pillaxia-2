import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

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
      const { data, error } = await db
        .from("notification_settings")
        .select("*")
        .order("setting_key");
      
      if (error) throw error;
      return data as NotificationSetting[];
    },
    enabled: isAdmin, // Only fetch if user is admin
  });

  const updateSetting = useMutation({
    mutationFn: async ({ 
      settingKey, 
      isEnabled 
    }: { 
      settingKey: NotificationSettingKey; 
      isEnabled: boolean;
    }) => {
      const { error } = await db
        .from("notification_settings")
        .update({ is_enabled: isEnabled, updated_by: user?.id })
        .eq("setting_key", settingKey);
      
      if (error) throw error;
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
    const setting = settings?.find(s => s.setting_key === key);
    return setting?.is_enabled ?? true; // Default to enabled if not found
  };

  const getSetting = (key: NotificationSettingKey): NotificationSetting | undefined => {
    return settings?.find(s => s.setting_key === key);
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
