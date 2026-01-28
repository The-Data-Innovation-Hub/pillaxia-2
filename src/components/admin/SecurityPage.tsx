import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogPage } from "./AuditLogPage";
import { SecurityDashboardPage } from "./SecurityDashboardPage";
import { SecuritySettingsPage } from "./SecuritySettingsPage";
import { ComplianceReportPage } from "./ComplianceReportPage";
import { NotificationAnalyticsPage } from "./NotificationAnalyticsPage";
import { useSearchParams } from "react-router-dom";

const tabs = [
  { value: "dashboard", label: "Dashboard" },
  { value: "audit-logs", label: "Audit Logs" },
  { value: "settings", label: "Settings" },
  { value: "compliance", label: "Compliance Reports" },
  { value: "notifications", label: "Notifications" },
];

export function SecurityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "dashboard";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Security</h1>
        <p className="text-muted-foreground">
          Manage security settings, audit logs, and compliance reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-4 py-2 data-[state=active]:bg-background"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <SecurityDashboardPage />
        </TabsContent>

        <TabsContent value="audit-logs" className="mt-6">
          <AuditLogPage />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <SecuritySettingsPage />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceReportPage />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationAnalyticsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
