import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PatientSidebar } from "./PatientSidebar";
import { useActivityTracking } from "@/hooks/useActivityTracking";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VersionBadge } from "@/components/VersionBadge";
import pillaxiaLogo from "@/assets/pillaxia-logo.png";

export function PatientLayout() {
  // Initialize activity tracking for page views
  useActivityTracking();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full max-w-full overflow-x-hidden bg-background">
        <PatientSidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
            <div className="flex items-center gap-4 min-w-0">
              <SidebarTrigger aria-label="Toggle sidebar" />
              <img src={pillaxiaLogo} alt="Pillaxia" className="h-7 shrink-0" />
              <VersionBadge />
            </div>
            <ThemeToggle />
          </header>
          <div id="main-content" className="flex-1 p-4 sm:p-6 overflow-x-hidden overflow-y-auto w-full max-w-full" role="main">
            <div className="w-full max-w-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
