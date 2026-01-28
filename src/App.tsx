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
  AngelaPage,
  CaregiversHubPage,
  HealthHubPage,
  CaregiverNotificationHistoryPage,
  PatientSettingsPage,
  NotificationsHubPage,
  AppointmentsCalendarPage,
} from "@/components/patient";
import {
  ClinicianLayout,
  ClinicianDashboardHome,
  PatientRosterPage,
  MedicationReviewPage,
  AdherenceMonitorPage,
  SOAPNotesPage,
  AppointmentsPage,
  EPrescribingPage,
  ClinicianSettingsPage,
} from "@/components/clinician";
import { VideoRoom } from "@/components/telemedicine";
import {
  PharmacistLayout,
  PharmacistDashboardHome,
  PrescriptionsPage,
  InventoryPage,
  RefillRequestsPage,
  ControlledDrugRegisterPage,
  MedicationAvailabilityPage,
  DrugRecallsPage,
  DrugTransfersPage,
  PharmacyPrescriptionsPage,
} from "@/components/pharmacist";
import {
  AdminLayout,
  AdminDashboardHome,
  UserManagementPage,
  SystemAnalyticsPage,
  SettingsPage,
  NotificationAnalyticsPage,
  ABTestingPage,
  PatientEngagementPage,
  LicenseCompliancePage,
  SecurityPage,
} from "@/components/admin";
import { HelpPage } from "@/components/shared";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";

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
              <SessionTimeoutWarning />
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
        <Route path="appointments" element={<AppointmentsCalendarPage />} />
        <Route path="health" element={<HealthHubPage />} />
        <Route path="symptoms" element={<Navigate to="/dashboard/health" replace />} />
        <Route path="vitals" element={<Navigate to="/dashboard/health" replace />} />
        <Route path="lab-results" element={<Navigate to="/dashboard/health" replace />} />
        <Route path="health-profile" element={<Navigate to="/dashboard/health" replace />} />
        <Route path="caregivers" element={<CaregiversHubPage />} />
        <Route path="caregiver-view" element={<Navigate to="/dashboard/caregivers" replace />} />
        <Route path="caregiver-history" element={<CaregiverNotificationHistoryPage />} />
        <Route path="angela" element={<AngelaPage />} />
        <Route path="notifications" element={<NotificationsHubPage />} />
        {/* Clinician Routes */}
        <Route path="patients" element={<PatientRosterPage />} />
        <Route path="e-prescribing" element={<EPrescribingPage />} />
        <Route path="adherence" element={<AdherenceMonitorPage />} />
        <Route path="soap-notes" element={<SOAPNotesPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="clinician-settings" element={<ClinicianSettingsPage />} />
        <Route path="telemedicine/room/:roomId" element={<VideoRoom />} />
        {/* Pharmacist Routes */}
        <Route path="e-prescriptions" element={<PharmacyPrescriptionsPage />} />
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="availability" element={<MedicationAvailabilityPage />} />
        <Route path="controlled-drugs" element={<ControlledDrugRegisterPage />} />
        <Route path="recalls" element={<DrugRecallsPage />} />
        <Route path="transfers" element={<DrugTransfersPage />} />
        <Route path="refills" element={<RefillRequestsPage />} />
        {/* Admin Routes */}
        <Route path="users" element={<UserManagementPage />} />
        <Route path="license-compliance" element={<LicenseCompliancePage />} />
        <Route path="analytics" element={<SystemAnalyticsPage />} />
        <Route path="notification-analytics" element={<NotificationAnalyticsPage />} />
        <Route path="admin-settings" element={<SettingsPage />} />
        <Route path="ab-testing" element={<ABTestingPage />} />
        <Route path="patient-engagement" element={<PatientEngagementPage />} />
        <Route path="security" element={<SecurityPage />} />
        {/* Shared Routes */}
        <Route path="settings" element={<PatientSettingsPage />} />
        <Route path="sync-status" element={<Navigate to="/dashboard/notifications" replace />} />
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
