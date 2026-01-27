import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ThemeProvider } from "next-themes";
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
  CaregiversPage,
  CaregiverDashboardPage,
  HealthProfilePage,
  CaregiverNotificationHistoryPage,
  PatientSettingsPage,
  NotificationHistoryPage,
  SyncStatusPage,
} from "@/components/patient";
import {
  ClinicianLayout,
  ClinicianDashboardHome,
  PatientRosterPage,
  MedicationReviewPage,
  AdherenceMonitorPage,
  SOAPNotesPage,
  AppointmentsPage,
} from "@/components/clinician";
import {
  PharmacistLayout,
  PharmacistDashboardHome,
  PrescriptionsPage,
  InventoryPage,
  RefillRequestsPage,
  ControlledDrugRegisterPage,
  MedicationAvailabilityPage,
} from "@/components/pharmacist";
import {
  AdminLayout,
  AdminDashboardHome,
  UserManagementPage,
  SystemAnalyticsPage,
  AuditLogPage,
  SettingsPage,
  NotificationAnalyticsPage,
  ABTestingPage,
  PatientEngagementPage,
  LicenseCompliancePage,
} from "@/components/admin";
import { HelpPage } from "@/components/shared";

const queryClient = new QueryClient();

// These components must be rendered inside AuthProvider, so we define them here
// and they will be used within the AppRoutes component which is inside AuthProvider

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <LanguageProvider>
              <OfflineBanner />
              <AppRoutes />
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

// All routes and components that use useAuth must be inside this component
// which is rendered within AuthProvider
function AppRoutes() {
  return (
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
        <Route path="caregivers" element={<CaregiversPage />} />
        <Route path="caregiver-view" element={<CaregiverDashboardPage />} />
        <Route path="caregiver-history" element={<CaregiverNotificationHistoryPage />} />
        <Route path="angela" element={<AngelaPage />} />
        <Route path="notifications" element={<NotificationHistoryPage />} />
        <Route path="health-profile" element={<HealthProfilePage />} />
        {/* Clinician Routes */}
        <Route path="patients" element={<PatientRosterPage />} />
        <Route path="adherence" element={<AdherenceMonitorPage />} />
        <Route path="soap-notes" element={<SOAPNotesPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        {/* Pharmacist Routes */}
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="availability" element={<MedicationAvailabilityPage />} />
        <Route path="controlled-drugs" element={<ControlledDrugRegisterPage />} />
        <Route path="refills" element={<RefillRequestsPage />} />
        {/* Admin Routes */}
        <Route path="users" element={<UserManagementPage />} />
        <Route path="license-compliance" element={<LicenseCompliancePage />} />
        <Route path="analytics" element={<SystemAnalyticsPage />} />
        <Route path="notification-analytics" element={<NotificationAnalyticsPage />} />
        <Route path="audit-logs" element={<AuditLogPage />} />
        <Route path="admin-settings" element={<SettingsPage />} />
        <Route path="ab-testing" element={<ABTestingPage />} />
        <Route path="patient-engagement" element={<PatientEngagementPage />} />
        {/* Shared Routes */}
        <Route path="settings" element={<PatientSettingsPage />} />
        <Route path="sync-status" element={<SyncStatusPage />} />
        <Route path="help" element={<HelpPage />} />
      </Route>
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Protected route wrapper - now used inside AppRoutes which is inside AuthProvider
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

// Role-based dashboard router
function DashboardRouter() {
  const { isPatient, isClinician, isPharmacist, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Route based on role priority
  if (isAdmin) {
    return <AdminLayout />;
  }
  
  if (isPharmacist) {
    return <PharmacistLayout />;
  }
  
  if (isClinician) {
    return <ClinicianLayout />;
  }

  // Default to patient dashboard
  return <PatientLayout />;
}

// Determine which home component to show based on role
function DashboardHome() {
  const { isAdmin, isClinician, isPharmacist } = useAuth();
  
  if (isAdmin) {
    return <AdminDashboardHome />;
  }
  if (isPharmacist) {
    return <PharmacistDashboardHome />;
  }
  if (isClinician) {
    return <ClinicianDashboardHome />;
  }
  return <PatientDashboardHome />;
}

export default App;
