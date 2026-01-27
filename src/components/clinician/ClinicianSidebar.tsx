import { Users, Pill, Activity, LayoutDashboard, LogOut, Heart, History, Bell, RefreshCw } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useHasCaregiverRelationships } from "@/hooks/useHasCaregiverRelationships";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";

export function ClinicianSidebar() {
  const { signOut, profile } = useAuth();
  const { t } = useLanguage();
  const { data: hasCaregiverRelationships } = useHasCaregiverRelationships();
  const { conflictCount } = useOfflineSync();

  const baseMenuItems = [
    { title: t.dashboard.overview, url: "/dashboard", icon: LayoutDashboard },
    { title: "Patient Roster", url: "/dashboard/patients", icon: Users },
    { title: "Medication Review", url: "/dashboard/medications", icon: Pill },
    { title: "Adherence Monitor", url: "/dashboard/adherence", icon: Activity },
    { title: t.notifications.title, url: "/dashboard/notifications", icon: Bell },
  ];

  const caregiverMenuItems = [
    { title: "Caregiver View", url: "/dashboard/caregiver-view", icon: Heart },
    { title: "Alert History", url: "/dashboard/caregiver-history", icon: History },
  ];

  const menuItems = hasCaregiverRelationships
    ? [...baseMenuItems, ...caregiverMenuItems]
    : baseMenuItems;

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">Rx</span>
          </div>
          <div>
            <h2 className="font-semibold text-sm">PillaxiaRx</h2>
            <p className="text-xs text-muted-foreground">Clinician Portal</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t space-y-2">
        <NavLink 
          to="/dashboard/sync-status"
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
          activeClassName="bg-primary/10 text-primary font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="flex-1">Sync Status</span>
          {conflictCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs font-medium">
              {conflictCount > 99 ? "99+" : conflictCount}
            </Badge>
          )}
        </NavLink>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-medium text-sm">
              {profile?.first_name?.[0] || "C"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              Dr. {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-muted-foreground">{t.auth.roleClinician}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {t.nav.signOut}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
