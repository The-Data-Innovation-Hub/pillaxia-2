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
      <div className="min-h-screen flex w-full bg-background">
        <PatientSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center justify-between px-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
              <SidebarTrigger aria-label="Toggle sidebar" />
              <img src={pillaxiaLogo} alt="Pillaxia" className="h-7" />
            </div>
            <ThemeToggle />
          </header>
          <div id="main-content" className="flex-1 p-6 overflow-auto" role="main">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
