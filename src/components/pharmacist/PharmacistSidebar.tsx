import { LayoutDashboard, FileText, Package, RefreshCw, LogOut, Bell, HelpCircle, Shield, Settings, MapPin, AlertTriangle, ArrowRightLeft } from "lucide-react";
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
  { title: "E-Prescriptions", url: "/dashboard/e-prescriptions", icon: FileText },
  { title: "Prescriptions", url: "/dashboard/prescriptions", icon: FileText },
  { title: "Inventory", url: "/dashboard/inventory", icon: Package },
  { title: "Availability", url: "/dashboard/availability", icon: MapPin },
  { title: "Controlled Drugs", url: "/dashboard/controlled-drugs", icon: Shield },
  { title: "Drug Recalls", url: "/dashboard/recalls", icon: AlertTriangle },
  { title: "Drug Transfers", url: "/dashboard/transfers", icon: ArrowRightLeft },
  { title: "Refill Requests", url: "/dashboard/refills", icon: RefreshCw },
  { title: "Notifications", url: "/dashboard/notifications", icon: Bell },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

export function PharmacistSidebar() {
  const { signOut, profile } = useAuth();

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.first_name || "User"} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {profile?.first_name?.[0] || "P"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium text-sm">
              {profile?.first_name} {profile?.last_name}
            </span>
            <span className="text-xs text-muted-foreground">Pharmacist</span>
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
                      activeClassName="bg-emerald-50 text-emerald-700 font-medium"
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
          activeClassName="bg-emerald-50 text-emerald-700 font-medium"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help & Support</span>
        </NavLink>
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-3 mt-2 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all duration-200 group"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
