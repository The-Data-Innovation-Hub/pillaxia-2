import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PatientSidebar } from "./PatientSidebar";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import { ThemeToggle } from "@/components/ThemeToggle";
import pillaxiaLogo from "@/assets/pillaxia-logo.png";

export function PatientLayout() {
  // Initialize activity tracking for page views
  useActivityTracking();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full overflow-x-hidden">
        <PatientSidebar />
        <main className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 border-b flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <img src={pillaxiaLogo} alt="Pillaxia" className="h-7" />
            </div>
            <ThemeToggle />
          </header>
          <div className="flex-1 min-w-0 p-6 overflow-auto overflow-x-hidden bg-muted/30">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
