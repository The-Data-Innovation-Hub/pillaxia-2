import { lazy } from "react";

// Patient components - lazy loaded
export const PatientDashboardHome = lazy(() => 
  import("@/components/patient/PatientDashboardHome").then(m => ({ default: m.PatientDashboardHome }))
);
export const MedicationsPage = lazy(() => 
  import("@/components/patient/MedicationsPage").then(m => ({ default: m.MedicationsPage }))
);
export const SchedulePage = lazy(() => 
  import("@/components/patient/SchedulePage").then(m => ({ default: m.SchedulePage }))
);
export const AngelaPage = lazy(() => 
  import("@/components/patient/AngelaPage").then(m => ({ default: m.AngelaPage }))
);
export const CaregiversHubPage = lazy(() => 
  import("@/components/patient/CaregiversHubPage").then(m => ({ default: m.CaregiversHubPage }))
);
export const HealthHubPage = lazy(() => 
  import("@/components/patient/HealthHubPage").then(m => ({ default: m.HealthHubPage }))
);
export const CaregiverNotificationHistoryPage = lazy(() => 
  import("@/components/patient/CaregiverNotificationHistoryPage").then(m => ({ default: m.CaregiverNotificationHistoryPage }))
);
export const PatientSettingsPage = lazy(() => 
  import("@/components/patient/PatientSettingsPage").then(m => ({ default: m.PatientSettingsPage }))
);
export const NotificationsHubPage = lazy(() => 
  import("@/components/patient/NotificationsHubPage").then(m => ({ default: m.NotificationsHubPage }))
);
export const AppointmentsCalendarPage = lazy(() => 
  import("@/components/patient/AppointmentsCalendarPage").then(m => ({ default: m.AppointmentsCalendarPage }))
);

// Clinician components - lazy loaded
export const ClinicianDashboardHome = lazy(() => 
  import("@/components/clinician/ClinicianDashboardHome").then(m => ({ default: m.ClinicianDashboardHome }))
);
export const PatientRosterPage = lazy(() => 
  import("@/components/clinician/PatientRosterPage").then(m => ({ default: m.PatientRosterPage }))
);
export const MedicationReviewPage = lazy(() => 
  import("@/components/clinician/MedicationReviewPage").then(m => ({ default: m.MedicationReviewPage }))
);
export const AdherenceMonitorPage = lazy(() => 
  import("@/components/clinician/AdherenceMonitorPage").then(m => ({ default: m.AdherenceMonitorPage }))
);
export const SOAPNotesPage = lazy(() => 
  import("@/components/clinician/SOAPNotesPage").then(m => ({ default: m.SOAPNotesPage }))
);
export const ClinicianAppointmentsPage = lazy(() => 
  import("@/components/clinician/AppointmentsPage").then(m => ({ default: m.AppointmentsPage }))
);
export const EPrescribingPage = lazy(() => 
  import("@/components/clinician/EPrescribingPage").then(m => ({ default: m.EPrescribingPage }))
);
export const ClinicianSettingsPage = lazy(() => 
  import("@/components/clinician/ClinicianSettingsPage").then(m => ({ default: m.ClinicianSettingsPage }))
);

// Pharmacist components - lazy loaded
export const PharmacistDashboardHome = lazy(() => 
  import("@/components/pharmacist/PharmacistDashboardHome").then(m => ({ default: m.PharmacistDashboardHome }))
);
export const PrescriptionsPage = lazy(() => 
  import("@/components/pharmacist/PrescriptionsPage").then(m => ({ default: m.PrescriptionsPage }))
);
export const InventoryPage = lazy(() => 
  import("@/components/pharmacist/InventoryPage").then(m => ({ default: m.InventoryPage }))
);
export const RefillRequestsPage = lazy(() => 
  import("@/components/pharmacist/RefillRequestsPage").then(m => ({ default: m.RefillRequestsPage }))
);
export const ControlledDrugRegisterPage = lazy(() => 
  import("@/components/pharmacist/ControlledDrugRegisterPage").then(m => ({ default: m.ControlledDrugRegisterPage }))
);
export const MedicationAvailabilityPage = lazy(() => 
  import("@/components/pharmacist/MedicationAvailabilityPage").then(m => ({ default: m.MedicationAvailabilityPage }))
);
export const DrugRecallsPage = lazy(() => 
  import("@/components/pharmacist/DrugRecallsPage").then(m => ({ default: m.DrugRecallsPage }))
);
export const DrugTransfersPage = lazy(() => 
  import("@/components/pharmacist/DrugTransfersPage").then(m => ({ default: m.DrugTransfersPage }))
);
export const PharmacyPrescriptionsPage = lazy(() => 
  import("@/components/pharmacist/PharmacyPrescriptionsPage").then(m => ({ default: m.PharmacyPrescriptionsPage }))
);

// Admin components - lazy loaded
export const AdminDashboardHome = lazy(() => 
  import("@/components/admin/AdminDashboardHome").then(m => ({ default: m.AdminDashboardHome }))
);
export const UserManagementPage = lazy(() => 
  import("@/components/admin/UserManagementPage").then(m => ({ default: m.UserManagementPage }))
);
export const SystemAnalyticsPage = lazy(() => 
  import("@/components/admin/SystemAnalyticsPage").then(m => ({ default: m.SystemAnalyticsPage }))
);
export const SettingsPage = lazy(() => 
  import("@/components/admin/SettingsPage").then(m => ({ default: m.SettingsPage }))
);
export const NotificationAnalyticsPage = lazy(() => 
  import("@/components/admin/NotificationAnalyticsPage").then(m => ({ default: m.NotificationAnalyticsPage }))
);
export const ABTestingPage = lazy(() => 
  import("@/components/admin/ABTestingPage").then(m => ({ default: m.ABTestingPage }))
);
export const PatientEngagementPage = lazy(() => 
  import("@/components/admin/PatientEngagementPage").then(m => ({ default: m.PatientEngagementPage }))
);
export const LicenseCompliancePage = lazy(() => 
  import("@/components/admin/LicenseCompliancePage").then(m => ({ default: m.LicenseCompliancePage }))
);
export const SecurityPage = lazy(() => 
  import("@/components/admin/SecurityPage").then(m => ({ default: m.SecurityPage }))
);
export const OrganizationManagementPage = lazy(() => 
  import("@/components/admin/OrganizationManagementPage").then(m => ({ default: m.OrganizationManagementPage }))
);

// Shared components - lazy loaded
export const HelpPage = lazy(() => 
  import("@/components/shared/HelpPage").then(m => ({ default: m.HelpPage }))
);

// Telemedicine - lazy loaded
export const VideoRoom = lazy(() => 
  import("@/components/telemedicine/VideoRoom").then(m => ({ default: m.VideoRoom }))
);
