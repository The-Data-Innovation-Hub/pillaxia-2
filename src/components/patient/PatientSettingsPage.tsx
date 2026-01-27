import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ProfileSettingsTab,
  NotificationsSettingsTab,
  PreferencesSettingsTab,
  SecuritySettingsTab,
} from "@/components/patient/settings";
import { User, Bell, Settings, Shield } from "lucide-react";

export function PatientSettingsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  if (!user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.settings.title}</h1>
        <p className="text-muted-foreground">{t.settings.subtitle}</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="profile" className="flex items-center gap-2 px-4">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2 px-4">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2 px-4">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2 px-4">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettingsTab />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsSettingsTab />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesSettingsTab />
        </TabsContent>

        <TabsContent value="security">
          <SecuritySettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
