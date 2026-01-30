/**
 * Centralized exports for all custom hooks.
 * Provides a single import point for commonly used hooks.
 */

// Authentication hooks
export { useAuthState, type AppRole, type Profile } from "./useAuthState";
export { useAuthActions } from "./useAuthActions";

// Organization hooks  
export { useOrgData, fetchOrganizationData, type Organization, type OrganizationBranding, type OrganizationMember } from "./useOrgData";
export { useOrgBranding, applyBrandingToDOM, DEFAULT_BRANDING } from "./useOrgBranding";

// UI/UX hooks
export { useIsMobile } from "./use-mobile";
export { useToast, toast } from "./use-toast";
export { useFocusVisible } from "./useFocusVisible";
export { useReducedMotion } from "./useReducedMotion";

// Offline/Cache hooks
export { useOfflineStatus } from "./useOfflineStatus";
export { useOfflineSync } from "./useOfflineSync";
export { useCachedMedications } from "./useCachedMedications";
export { useCachedSymptoms } from "./useCachedSymptoms";
export { useCachedTodaysSchedule } from "./useCachedTodaysSchedule";
export { useOfflineMedicationLog } from "./useOfflineMedicationLog";
export { useOfflineSymptomLog } from "./useOfflineSymptomLog";

// Feature hooks
export { getABTestVariant, recordABTestAssignment } from "./useABTest";
export { useActivityTracking } from "./useActivityTracking";
export { useAutoResolutionPreferences } from "./useAutoResolutionPreferences";
export { useBiometricAuth } from "./useBiometricAuth";
export { useDrugInteractions } from "./useDrugInteractions";
export { useHaptics } from "./useHaptics";
export { useHasCaregiverRelationships } from "./useHasCaregiverRelationships";
export { useLoginAttempts } from "./useLoginAttempts";
export { useMissedDoseAlerts } from "./useMissedDoseAlerts";

// Notification hooks
export { useNativePushNotifications } from "./useNativePushNotifications";
export { useNotificationSettings } from "./useNotificationSettings";
export { usePushNotifications } from "./usePushNotifications";
export { useUnifiedPushNotifications } from "./useUnifiedPushNotifications";

// Security hooks
export { usePasswordBreachCheck } from "./usePasswordBreachCheck";
export { useSecurityEvents } from "./useSecurityEvents";
export { useSecurityNotificationPreferences } from "./useSecurityNotificationPreferences";
export { useSessionManager } from "./useSessionManager";
export { useTrustedDevices } from "./useTrustedDevices";

// Data hooks
export { useOrganizationMembers } from "./useOrganizationMembers";
export { usePatientCDSData } from "./usePatientCDSData";
export { usePrescriptions } from "./usePrescriptions";
export { useVideoCall } from "./useVideoCall";
