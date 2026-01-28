import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useHasCaregiverRelationships } from "@/hooks/useHasCaregiverRelationships";
import { useOfflineSync } from "@/hooks/useOfflineSync";
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";

export function PatientSidebar() {
  const { signOut, profile } = useAuth();
  const { t } = useLanguage();
  const { data: hasCaregiverRelationships } = useHasCaregiverRelationships();
  const { conflictCount } = useOfflineSync();

  const baseMenuItems = [
    { title: t.dashboard.overview, url: "/dashboard", icon: LayoutDashboard },
    { title: t.medications.title, url: "/dashboard/medications", icon: Pill },
    { title: t.schedule.title, url: "/dashboard/schedule", icon: Calendar },
    { title: t.symptoms.title, url: "/dashboard/symptoms", icon: ClipboardList },
    { title: "Health Profile", url: "/dashboard/health-profile", icon: Heart },
    { title: t.caregivers.title, url: "/dashboard/caregivers", icon: Users },
    { title: t.notifications.title, url: "/dashboard/notifications", icon: Bell },
    { title: t.angela.title, url: "/dashboard/angela", icon: Bot },
  ];

  const caregiverMenuItems = [
    { title: "Caregiver View", url: "/dashboard/caregiver-view", icon: Heart },
    { title: "Alert History", url: "/dashboard/caregiver-history", icon: History },
  ];

  const menuItems = hasCaregiverRelationships
    ? [...baseMenuItems.slice(0, 6), ...caregiverMenuItems, baseMenuItems[6], baseMenuItems[7]]
    : baseMenuItems;

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.first_name || "User"} />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {profile?.first_name?.[0] || "P"}
            </AvatarFallback>
          </Avatar>
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
          <span className="flex-1">Sync Status</span>
          {conflictCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs font-medium">
              {conflictCount > 99 ? "99+" : conflictCount}
            </Badge>
          )}
        </NavLink>
        <NavLink 
          to="/dashboard/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
          activeClassName="bg-primary/10 text-primary font-medium"
        >
          <Settings className="h-4 w-4" />
          <span>{t.nav.settings}</span>
        </NavLink>
        <NavLink 
          to="/dashboard/help"
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
          activeClassName="bg-primary/10 text-primary font-medium"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help & Support</span>
        </NavLink>
        <ThemeToggle />
        <Button 
          variant="outline"
          className="w-full justify-start gap-3 mt-2 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-200 group"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span>{t.nav.signOut}</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
