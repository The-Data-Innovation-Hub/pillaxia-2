import { LayoutDashboard, Users, BarChart3, FileText, LogOut, Shield, Settings, Bell, TrendingUp, FlaskConical, Activity, HelpCircle, BadgeCheck, ShieldCheck, Lock } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
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

const menuItems = [
  { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
  { title: "User Management", url: "/dashboard/users", icon: Users },
  { title: "License Compliance", url: "/dashboard/license-compliance", icon: BadgeCheck },
  { title: "System Analytics", url: "/dashboard/analytics", icon: BarChart3 },
  { title: "Notification Analytics", url: "/dashboard/notification-analytics", icon: TrendingUp },
  { title: "Patient Engagement", url: "/dashboard/patient-engagement", icon: Activity },
  { title: "A/B Testing", url: "/dashboard/ab-testing", icon: FlaskConical },
  { title: "Audit Logs", url: "/dashboard/audit-logs", icon: FileText },
  { title: "Security Dashboard", url: "/dashboard/security", icon: ShieldCheck },
  { title: "Security Settings", url: "/dashboard/security-settings", icon: Lock },
  { title: "Notifications", url: "/dashboard/notifications", icon: Bell },
  { title: "Settings", url: "/dashboard/admin-settings", icon: Settings },
];

export function AdminSidebar() {
  const { signOut, profile } = useAuth();

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.first_name || "User"} />
            <AvatarFallback className="bg-destructive/10 text-destructive font-medium">
              {profile?.first_name?.[0] || "A"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {profile?.first_name} {profile?.last_name}
            </span>
            <span className="text-xs text-muted-foreground">System Administrator</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
                      activeClassName="bg-destructive/10 text-destructive font-medium"
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
          activeClassName="bg-destructive/10 text-destructive font-medium"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help & Support</span>
        </NavLink>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
