import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useHasCaregiverRelationships } from "@/hooks/useHasCaregiverRelationships";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Pill, 
  Calendar, 
  ClipboardList, 
  Settings,
  LogOut,
  Bot,
  Users,
  Heart,
  History,
  Bell,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function PatientSidebar() {
  const { signOut, profile } = useAuth();
  const { t } = useLanguage();
  const { data: hasCaregiverRelationships } = useHasCaregiverRelationships();

  const baseMenuItems = [
    { title: t.dashboard.overview, url: "/dashboard", icon: LayoutDashboard },
    { title: t.medications.title, url: "/dashboard/medications", icon: Pill },
    { title: t.schedule.title, url: "/dashboard/schedule", icon: Calendar },
    { title: t.symptoms.title, url: "/dashboard/symptoms", icon: ClipboardList },
    { title: t.caregivers.title, url: "/dashboard/caregivers", icon: Users },
    { title: t.notifications.title, url: "/dashboard/notifications", icon: Bell },
    { title: t.angela.title, url: "/dashboard/angela", icon: Bot },
  ];

  const caregiverMenuItems = [
    { title: "Caregiver View", url: "/dashboard/caregiver-view", icon: Heart },
    { title: "Alert History", url: "/dashboard/caregiver-history", icon: History },
  ];

  const menuItems = hasCaregiverRelationships
    ? [...baseMenuItems.slice(0, 5), ...caregiverMenuItems, baseMenuItems[5], baseMenuItems[6]]
    : baseMenuItems;

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
            {profile?.first_name?.[0] || "P"}
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {profile?.first_name} {profile?.last_name}
            </span>
            <span className="text-xs text-muted-foreground">{t.auth.rolePatient}</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
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

      <SidebarFooter className="border-t p-4 space-y-2">
        <NavLink 
          to="/dashboard/sync-status"
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
          activeClassName="bg-primary/10 text-primary font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Sync Status</span>
        </NavLink>
        <NavLink 
          to="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
          activeClassName="bg-primary/10 text-primary font-medium"
        >
          <Settings className="h-4 w-4" />
          <span>{t.nav.settings}</span>
        </NavLink>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          <span>{t.nav.signOut}</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
