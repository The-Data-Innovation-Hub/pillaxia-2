import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import {
  PatientLayout,
  PatientDashboardHome,
  MedicationsPage,
  SchedulePage,
  SymptomsPage,
  AngelaPage,
} from "@/components/patient";
import {
  ClinicianLayout,
  ClinicianDashboardHome,
  PatientRosterPage,
  MedicationReviewPage,
  AdherenceMonitorPage,
} from "@/components/clinician";

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Patient Dashboard Layout
function PatientDashboard() {
  return <PatientLayout />;
}

// Clinician Dashboard Layout
function ClinicianDashboard() {
  return <ClinicianLayout />;
}

// Role-based dashboard router
function DashboardRouter() {
  const { isPatient, isClinician, isPharmacist, isAdmin, roles, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Clinician gets their own dashboard
  if (isClinician) {
    return <ClinicianDashboard />;
  }

  // Default to patient dashboard
  return <PatientDashboard />;
}

// Determine which home component to show based on role
function DashboardHome() {
  const { isClinician } = useAuth();
  return isClinician ? <ClinicianDashboardHome /> : <PatientDashboardHome />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected Dashboard Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardRouter />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHome />} />
              {/* Patient Routes */}
              <Route path="medications" element={<MedicationsPage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="symptoms" element={<SymptomsPage />} />
              <Route path="angela" element={<AngelaPage />} />
              {/* Clinician Routes */}
              <Route path="patients" element={<PatientRosterPage />} />
              <Route path="adherence" element={<AdherenceMonitorPage />} />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
