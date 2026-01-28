import { Settings, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SyncStatusPage } from "@/components/patient/SyncStatusPage";
import { NotificationHistoryPage } from "@/components/patient/NotificationHistoryPage";
import { ClinicianProfileTab } from "./ClinicianProfileTab";

export function ClinicianSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your profile, sync status, and notification preferences
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile" className="px-6">Profile</TabsTrigger>
          <TabsTrigger value="sync" className="px-6">Sync Status</TabsTrigger>
          <TabsTrigger value="notifications" className="px-6">Notifications</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="mt-6">
          <ClinicianProfileTab />
        </TabsContent>
        
        <TabsContent value="sync" className="mt-6">
          <SyncStatusPage />
        </TabsContent>
        
        <TabsContent value="notifications" className="mt-6">
          <NotificationHistoryPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
