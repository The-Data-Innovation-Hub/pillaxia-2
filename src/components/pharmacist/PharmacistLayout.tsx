import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PharmacistSidebar } from "./PharmacistSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import pillaxiaLogo from "@/assets/pillaxia-logo.png";

export function PharmacistLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <PharmacistSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <img src={pillaxiaLogo} alt="Pillaxia" className="h-7" />
            </div>
            <ThemeToggle />
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
