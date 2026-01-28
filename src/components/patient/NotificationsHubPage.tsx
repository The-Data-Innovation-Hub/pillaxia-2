import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, History, RefreshCw } from "lucide-react";
import { NotificationHistoryPage } from "./NotificationHistoryPage";
import { SyncStatusPage } from "./SyncStatusPage";
import { NotificationCenterCard } from "./NotificationCenterCard";

export function NotificationsHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">
          Manage your notifications, view history, and monitor sync status
        </p>
      </div>

      <Tabs defaultValue="center" className="w-full">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="center" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span>Alert History</span>
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span>Sync Status</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="center" className="mt-6">
          <NotificationCenterCard />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <NotificationHistoryContent />
        </TabsContent>

        <TabsContent value="sync" className="mt-6">
          <SyncStatusContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Wrapper to remove the header from NotificationHistoryPage when used as tab content
function NotificationHistoryContent() {
  return (
    <div className="[&>div>div:first-child]:hidden">
      <NotificationHistoryPage />
    </div>
  );
}

// Wrapper to remove the header from SyncStatusPage when used as tab content
function SyncStatusContent() {
  return (
    <div className="[&>div>div:first-child]:hidden">
      <SyncStatusPage />
    </div>
  );
}
