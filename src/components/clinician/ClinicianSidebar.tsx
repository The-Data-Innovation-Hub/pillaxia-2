import { Users, Pill, Activity, LayoutDashboard, LogOut, Heart, History, FileText, CalendarDays, HelpCircle, Settings, Video } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { useHasCaregiverRelationships } from "@/hooks/useHasCaregiverRelationships";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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

  const baseMenuItems = [
    { title: t.dashboard.overview, url: "/dashboard", icon: LayoutDashboard },
    { title: "Patient Roster", url: "/dashboard/patients", icon: Users },
    { title: "E-Prescribing", url: "/dashboard/e-prescribing", icon: FileText },
    { title: "Telemedicine", url: "/dashboard/telemedicine", icon: Video },
    { title: "Medication Review", url: "/dashboard/medications", icon: Pill },
    { title: "Adherence Monitor", url: "/dashboard/adherence", icon: Activity },
    { title: "Appointments", url: "/dashboard/appointments", icon: CalendarDays },
    { title: "SOAP Notes", url: "/dashboard/soap-notes", icon: FileText },
    { title: "Settings", url: "/dashboard/clinician-settings", icon: Settings },
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
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.first_name || "User"} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {profile?.first_name?.[0] || "C"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              Dr. {profile?.first_name} {profile?.last_name}
            </span>
            <span className="text-xs text-muted-foreground">Healthcare Provider</span>
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
          to="/dashboard/help"
          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
          activeClassName="bg-primary/10 text-primary font-medium"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help & Support</span>
        </NavLink>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-3 mt-2 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-200 group"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          {t.nav.signOut}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
