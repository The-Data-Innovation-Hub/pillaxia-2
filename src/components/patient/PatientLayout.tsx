import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PatientSidebar } from "./PatientSidebar";

export function PatientLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PatientSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center px-4 gap-4">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold text-pillaxia-cyan">Pillaxia</h1>
          </header>
          <div className="flex-1 p-6 overflow-auto bg-muted/30">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
