import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  route?: string;
  completed: boolean;
}

export interface OnboardingConfig {
  steps: OnboardingStep[];
  tourSteps: TourStep[];
}

export interface TourStep {
  id: string;
  target: string;
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

interface OnboardingContextType {
  isOnboardingComplete: boolean;
  currentStep: number;
  steps: OnboardingStep[];
  tourSteps: TourStep[];
  showTour: boolean;
  showChecklist: boolean;
  completeStep: (stepId: string) => void;
  setShowTour: (show: boolean) => void;
  setShowChecklist: (show: boolean) => void;
  resetOnboarding: () => void;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  currentTourStep: number;
  endTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

// Role-specific onboarding configurations
const patientOnboarding: OnboardingConfig = {
  steps: [
    { id: "add-medication", title: "Add your first medication", description: "Go to Medications and add a medication you take", completed: false },
    { id: "set-schedule", title: "Set up your schedule", description: "Configure reminder times for your medications", completed: false },
    { id: "explore-angela", title: "Meet Angela AI", description: "Chat with your AI health assistant", completed: false },
    { id: "configure-notifications", title: "Set up notifications", description: "Choose how you want to receive reminders", completed: false },
    { id: "add-caregiver", title: "Invite a caregiver", description: "Add a family member to help monitor your health", completed: false },
  ],
  tourSteps: [
    { id: "dashboard", target: "[data-tour='dashboard']", title: "Welcome to Your Dashboard", content: "This is your personalized health dashboard where you can see all your important information at a glance." },
    { id: "medications", target: "[data-tour='medications']", title: "Medications", content: "Track all your medications here. Add new ones, set schedules, and never miss a dose." },
    { id: "schedule", target: "[data-tour='schedule']", title: "Daily Schedule", content: "View your medication schedule for the day and mark doses as taken." },
    { id: "angela", target: "[data-tour='angela']", title: "Meet Angela", content: "Your AI health assistant is here to answer questions and provide support." },
    { id: "notifications", target: "[data-tour='notifications']", title: "Notifications", content: "Manage how and when you receive medication reminders." },
  ],
};

const clinicianOnboarding: OnboardingConfig = {
  steps: [
    { id: "view-roster", title: "Review patient roster", description: "See your assigned patients", completed: false },
    { id: "create-prescription", title: "Create a prescription", description: "Use e-prescribing to send a prescription", completed: false },
    { id: "check-adherence", title: "Check adherence", description: "Review patient medication adherence", completed: false },
    { id: "write-soap", title: "Write a SOAP note", description: "Document a patient encounter", completed: false },
    { id: "schedule-appointment", title: "Schedule an appointment", description: "Set up a patient appointment", completed: false },
  ],
  tourSteps: [
    { id: "dashboard", target: "[data-tour='dashboard']", title: "Clinician Dashboard", content: "Your central hub for patient care activities and alerts." },
    { id: "patients", target: "[data-tour='patients']", title: "Patient Roster", content: "View and manage your assigned patients here." },
    { id: "prescriptions", target: "[data-tour='prescriptions']", title: "E-Prescribing", content: "Send electronic prescriptions directly to pharmacies." },
    { id: "adherence", target: "[data-tour='adherence']", title: "Adherence Monitor", content: "Track how well patients are following their medication regimens." },
  ],
};

const pharmacistOnboarding: OnboardingConfig = {
  steps: [
    { id: "review-prescriptions", title: "Review prescriptions", description: "Check incoming e-prescriptions", completed: false },
    { id: "update-inventory", title: "Update inventory", description: "Manage medication stock levels", completed: false },
    { id: "process-refill", title: "Process a refill request", description: "Handle patient refill requests", completed: false },
    { id: "check-controlled", title: "Check controlled drugs", description: "Review the controlled substance register", completed: false },
  ],
  tourSteps: [
    { id: "dashboard", target: "[data-tour='dashboard']", title: "Pharmacy Dashboard", content: "Manage prescriptions, inventory, and patient requests from here." },
    { id: "prescriptions", target: "[data-tour='prescriptions']", title: "Prescriptions", content: "View and dispense incoming prescriptions." },
    { id: "inventory", target: "[data-tour='inventory']", title: "Inventory", content: "Track stock levels and manage medication availability." },
    { id: "refills", target: "[data-tour='refills']", title: "Refill Requests", content: "Process patient refill requests efficiently." },
  ],
};

const adminOnboarding: OnboardingConfig = {
  steps: [
    { id: "review-users", title: "Review users", description: "Check user management dashboard", completed: false },
    { id: "check-analytics", title: "Check analytics", description: "View system usage analytics", completed: false },
    { id: "configure-settings", title: "Configure settings", description: "Review system settings", completed: false },
    { id: "check-security", title: "Check security", description: "Review security dashboard", completed: false },
  ],
  tourSteps: [
    { id: "dashboard", target: "[data-tour='dashboard']", title: "Admin Dashboard", content: "Overview of system health, user activity, and key metrics." },
    { id: "users", target: "[data-tour='users']", title: "User Management", content: "Manage user accounts, roles, and permissions." },
    { id: "analytics", target: "[data-tour='analytics']", title: "Analytics", content: "Deep dive into system usage and engagement metrics." },
    { id: "security", target: "[data-tour='security']", title: "Security", content: "Monitor security events and manage compliance." },
  ],
};

const ONBOARDING_DISABLED_KEY = "progressive_onboarding_disabled";

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { isPatient, isClinician, isPharmacist, isAdmin, isManager, user } = useAuth();
  
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [tourSteps, setTourSteps] = useState<TourStep[]>([]);
  const [showTour, setShowTour] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [isOnboardingDisabled, setIsOnboardingDisabled] = useState(false);

  // Listen for changes to the onboarding disabled preference
  // Default is OFF (disabled = true) unless explicitly set to "false"
  useEffect(() => {
    const checkDisabled = () => {
      const storedValue = localStorage.getItem(ONBOARDING_DISABLED_KEY);
      // Default to disabled (off) if not explicitly set to "false"
      const disabled = storedValue !== "false";
      setIsOnboardingDisabled(disabled);
      if (disabled) {
        setShowTour(false);
        setShowChecklist(false);
      }
    };

    checkDisabled();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ONBOARDING_DISABLED_KEY) {
        checkDisabled();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Load onboarding state from localStorage
  useEffect(() => {
    if (!user || isOnboardingDisabled) return;

    const storageKey = `onboarding_${user.id}`;
    const saved = localStorage.getItem(storageKey);
    
    let config: OnboardingConfig;
    if (isAdmin || isManager) {
      config = adminOnboarding;
    } else if (isPharmacist) {
      config = pharmacistOnboarding;
    } else if (isClinician) {
      config = clinicianOnboarding;
    } else {
      config = patientOnboarding;
    }

    if (saved) {
      const parsed = JSON.parse(saved);
      const mergedSteps = config.steps.map(step => ({
        ...step,
        completed: parsed.completedSteps?.includes(step.id) || false,
      }));
      setSteps(mergedSteps);
      setIsOnboardingComplete(parsed.isComplete || false);
      // Only show checklist if not complete and user has seen the tour
      if (!parsed.isComplete && parsed.hasSeenTour) {
        setShowChecklist(true);
      }
    } else {
      setSteps(config.steps);
      // First time user - start tour automatically
      setShowTour(true);
    }
    
    setTourSteps(config.tourSteps);
  }, [user, isAdmin, isManager, isPharmacist, isClinician, isPatient, isOnboardingDisabled]);

  // Save state to localStorage
  useEffect(() => {
    if (!user) return;
    
    const storageKey = `onboarding_${user.id}`;
    const completedSteps = steps.filter(s => s.completed).map(s => s.id);
    const isComplete = steps.length > 0 && steps.every(s => s.completed);
    
    localStorage.setItem(storageKey, JSON.stringify({
      completedSteps,
      isComplete,
      hasSeenTour: !showTour,
    }));
    
    setIsOnboardingComplete(isComplete);
  }, [steps, showTour, user]);

  const completeStep = (stepId: string) => {
    setSteps(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, completed: true } : step
      )
    );
  };

  const resetOnboarding = () => {
    if (!user) return;
    localStorage.removeItem(`onboarding_${user.id}`);
    setSteps(prev => prev.map(s => ({ ...s, completed: false })));
    setIsOnboardingComplete(false);
    setShowTour(true);
  };

  const startTour = () => {
    setCurrentTourStep(0);
    setShowTour(true);
  };

  const nextTourStep = () => {
    if (currentTourStep < tourSteps.length - 1) {
      setCurrentTourStep(prev => prev + 1);
    } else {
      endTour();
    }
  };

  const prevTourStep = () => {
    if (currentTourStep > 0) {
      setCurrentTourStep(prev => prev - 1);
    }
  };

  const endTour = () => {
    setShowTour(false);
    setShowChecklist(true);
  };

  const currentStep = steps.findIndex(s => !s.completed);

  return (
    <OnboardingContext.Provider
      value={{
        isOnboardingComplete,
        currentStep: currentStep === -1 ? steps.length : currentStep,
        steps,
        tourSteps,
        showTour,
        showChecklist,
        completeStep,
        setShowTour,
        setShowChecklist,
        resetOnboarding,
        startTour,
        nextTourStep,
        prevTourStep,
        currentTourStep,
        endTour,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
