import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { OfflineBanner } from "@/components/OfflineBanner";
import { EnvironmentBanner } from "@/components/EnvironmentBanner";
import { DemoDataBanner } from "@/components/DemoDataBanner";
import { ThemeProvider } from "next-themes";
import { PageLoadingFallback } from "@/components/ui/loading-spinner";
import { OnboardingProvider, TourOverlay, OnboardingChecklist } from "@/components/onboarding";
import { SkipLink } from "@/components/a11y";
import { SentryErrorBoundary } from "@/components/SentryErrorBoundary";
import { useServerVerifiedRoles } from "@/hooks/useServerVerifiedRoles";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SelectRolePage from "./pages/SelectRolePage";

// Layout components (not lazy - needed immediately)
import { PatientLayout } from "@/components/patient/PatientLayout";
import { ClinicianLayout } from "@/components/clinician/ClinicianLayout";
import { PharmacistLayout } from "@/components/pharmacist/PharmacistLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { SessionTimeoutWarning } from "@/components/SessionTimeoutWarning";

// Lazy loaded routes
import {
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
  ClinicianDashboardHome,
  PatientRosterPage,
  MedicationReviewPage,
  AdherenceMonitorPage,
  SOAPNotesPage,
  ClinicianAppointmentsPage,
  EPrescribingPage,
  ClinicianSettingsPage,
  PharmacistDashboardHome,
  PrescriptionsPage,
  InventoryPage,
  RefillRequestsPage,
  ControlledDrugRegisterPage,
  MedicationAvailabilityPage,
  DrugRecallsPage,
  DrugTransfersPage,
  PharmacyPrescriptionsPage,
  AdminDashboardHome,
  UserManagementPage,
  SystemAnalyticsPage,
  SettingsPage,
  NotificationAnalyticsPage,
  ABTestingPage,
  PatientEngagementPage,
  LicenseCompliancePage,
  SecurityPage,
  OrganizationManagementPage,
  HelpPage,
  VideoRoom,
} from "@/routes/lazy-routes";

const queryClient = new QueryClient();

const App = () => (
  <SentryErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <OrganizationProvider>
                <LanguageProvider>
                  <OnboardingProvider>
                    <SkipLink href="#main-content" />
                    <EnvironmentBanner />
                    <DemoDataBanner />
                    <OfflineBanner />
                    <SessionTimeoutWarning />
                    <TourOverlay />
                    <OnboardingChecklist />
                    <AppRoutes />
                  </OnboardingProvider>
                </LanguageProvider>
              </OrganizationProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </SentryErrorBoundary>
);

// Suspense wrapper for lazy loaded routes
function SuspenseRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoadingFallback />}>{children}</Suspense>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomeOrDashboard />} />
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
        <Route index element={<SuspenseRoute><DashboardHome /></SuspenseRoute>} />
        {/* Patient Routes */}
        <Route path="medications" element={<SuspenseRoute><MedicationsPage /></SuspenseRoute>} />
        <Route path="schedule" element={<SuspenseRoute><SchedulePage /></SuspenseRoute>} />
        <Route path="appointments" element={<SuspenseRoute><AppointmentsCalendarPage /></SuspenseRoute>} />
        <Route path="health" element={<SuspenseRoute><HealthHubPage /></SuspenseRoute>} />
        <Route path="symptoms" element={<Navigate to="/dashboard/health" replace />} />
        <Route path="vitals" element={<Navigate to="/dashboard/health" replace />} />
        <Route path="lab-results" element={<Navigate to="/dashboard/health" replace />} />
        <Route path="health-profile" element={<Navigate to="/dashboard/health" replace />} />
        <Route path="caregivers" element={<SuspenseRoute><CaregiversHubPage /></SuspenseRoute>} />
        <Route path="caregiver-view" element={<Navigate to="/dashboard/caregivers" replace />} />
        <Route path="caregiver-history" element={<SuspenseRoute><CaregiverNotificationHistoryPage /></SuspenseRoute>} />
        <Route path="angela" element={<SuspenseRoute><AngelaPage /></SuspenseRoute>} />
        <Route path="notifications" element={<SuspenseRoute><NotificationsHubPage /></SuspenseRoute>} />
        {/* Clinician Routes */}
        <Route path="patients" element={<SuspenseRoute><PatientRosterPage /></SuspenseRoute>} />
        <Route path="e-prescribing" element={<SuspenseRoute><EPrescribingPage /></SuspenseRoute>} />
        <Route path="adherence" element={<SuspenseRoute><AdherenceMonitorPage /></SuspenseRoute>} />
        <Route path="soap-notes" element={<SuspenseRoute><SOAPNotesPage /></SuspenseRoute>} />
        <Route path="clinician-appointments" element={<SuspenseRoute><ClinicianAppointmentsPage /></SuspenseRoute>} />
        <Route path="clinician-settings" element={<SuspenseRoute><ClinicianSettingsPage /></SuspenseRoute>} />
        <Route path="telemedicine/room/:roomId" element={<SuspenseRoute><VideoRoom /></SuspenseRoute>} />
        {/* Pharmacist Routes */}
        <Route path="e-prescriptions" element={<SuspenseRoute><PharmacyPrescriptionsPage /></SuspenseRoute>} />
        <Route path="prescriptions" element={<SuspenseRoute><PrescriptionsPage /></SuspenseRoute>} />
        <Route path="inventory" element={<SuspenseRoute><InventoryPage /></SuspenseRoute>} />
        <Route path="availability" element={<SuspenseRoute><MedicationAvailabilityPage /></SuspenseRoute>} />
        <Route path="controlled-drugs" element={<SuspenseRoute><ControlledDrugRegisterPage /></SuspenseRoute>} />
        <Route path="recalls" element={<SuspenseRoute><DrugRecallsPage /></SuspenseRoute>} />
        <Route path="transfers" element={<SuspenseRoute><DrugTransfersPage /></SuspenseRoute>} />
        <Route path="refills" element={<SuspenseRoute><RefillRequestsPage /></SuspenseRoute>} />
        {/* Admin Routes */}
        <Route path="users" element={<SuspenseRoute><UserManagementPage /></SuspenseRoute>} />
        <Route path="license-compliance" element={<SuspenseRoute><LicenseCompliancePage /></SuspenseRoute>} />
        <Route path="analytics" element={<SuspenseRoute><SystemAnalyticsPage /></SuspenseRoute>} />
        <Route path="notification-analytics" element={<SuspenseRoute><NotificationAnalyticsPage /></SuspenseRoute>} />
        <Route path="admin-settings" element={<SuspenseRoute><SettingsPage /></SuspenseRoute>} />
        <Route path="ab-testing" element={<SuspenseRoute><ABTestingPage /></SuspenseRoute>} />
        <Route path="patient-engagement" element={<SuspenseRoute><PatientEngagementPage /></SuspenseRoute>} />
        <Route path="security" element={<SuspenseRoute><SecurityPage /></SuspenseRoute>} />
        <Route path="organization" element={<SuspenseRoute><OrganizationManagementPage /></SuspenseRoute>} />
        {/* Shared Routes */}
        <Route path="settings" element={<SuspenseRoute><PatientSettingsPage /></SuspenseRoute>} />
        <Route path="sync-status" element={<Navigate to="/dashboard/notifications" replace />} />
        <Route path="help" element={<SuspenseRoute><HelpPage /></SuspenseRoute>} />
      </Route>
      
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Redirect authenticated users to dashboard, show landing page otherwise
function HomeOrDashboard() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoadingFallback />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Index />;
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoadingFallback />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Role-based dashboard router with server-side verification
function DashboardRouter() {
  const { user, loading: authLoading } = useAuth();
  const { 
    roles,
    isAdmin, 
    isManager, 
    isClinician, 
    isPharmacist, 
    verified, 
    loading: rolesLoading 
  } = useServerVerifiedRoles();

  // Show loading while either auth or server-verified roles are loading
  if (authLoading || rolesLoading) {
    return <PageLoadingFallback />;
  }

  // If roles aren't verified yet but we have a session, show loading
  if (!verified) {
    return <PageLoadingFallback />;
  }

  // New user with no role: show role selection so they can choose and save
  if (user && roles.length === 0) {
    return <SelectRolePage />;
  }

  // Route based on server-verified role priority
  if (isAdmin || isManager) {
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

// Determine which home component to show based on server-verified role
function DashboardHome() {
  const { isAdmin, isManager, isClinician, isPharmacist, verified, loading } = useServerVerifiedRoles();
  
  if (loading || !verified) {
    return <PageLoadingFallback />;
  }
  
  if (isAdmin || isManager) {
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
