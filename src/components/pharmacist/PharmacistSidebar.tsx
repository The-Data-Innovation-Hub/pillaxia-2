import { LayoutDashboard, FileText, Package, RefreshCw, LogOut, Bell, HelpCircle } from "lucide-react";
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
  { title: "Prescriptions", url: "/dashboard/prescriptions", icon: FileText },
  { title: "Inventory", url: "/dashboard/inventory", icon: Package },
  { title: "Refill Requests", url: "/dashboard/refills", icon: RefreshCw },
  { title: "Notifications", url: "/dashboard/notifications", icon: Bell },
];

export function PharmacistSidebar() {
  const { signOut, profile } = useAuth();

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Package className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">PillaxiaPharm</h2>
            <p className="text-xs text-muted-foreground">Pharmacy Portal</p>
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

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.first_name || "User"} />
            <AvatarFallback className="bg-emerald-100 text-emerald-700 font-medium text-sm">
              {profile?.first_name?.[0] || "P"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-muted-foreground">Pharmacist</p>
          </div>
        </div>
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
