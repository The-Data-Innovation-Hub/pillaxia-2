import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/integrations/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Pill,
  Bell,
  User,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Mail,
  Smartphone,
  Moon,
  Shield,
  Calendar,
  Clock,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingFlowProps {
  onComplete?: () => void;
}

interface OnboardingState {
  firstName: string;
  lastName: string;
  phone: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  hasChronicConditions: boolean;
  hasAllergies: boolean;
}

const STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "profile", title: "Your Profile", icon: User },
  { id: "notifications", title: "Notifications", icon: Bell },
  { id: "health", title: "Health Info", icon: Heart },
  { id: "complete", title: "All Set!", icon: CheckCircle2 },
];

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<OnboardingState>({
    firstName: profile?.first_name || "",
    lastName: profile?.last_name || "",
    phone: profile?.phone || "",
    emailEnabled: true,
    pushEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    hasChronicConditions: false,
    hasAllergies: false,
  });

  const { data: hasCompletedOnboarding, isLoading } = useQuery({
    queryKey: ["onboarding-status", user?.id],
    queryFn: async () => {
      if (!user) return true;

      // Consider onboarding complete if profile has a first_name set.
      // This avoids depending on patient_notification_preferences which may not be
      // fully migrated yet.
      if (profile?.first_name) return true;

      // Fallback: check notification preferences via API
      try {
        const { data } = await apiClient
          .from("patient_notification_preferences")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        return !!data;
      } catch {
        return false;
      }
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setState(prev => ({
        ...prev,
        firstName: profile.first_name || prev.firstName,
        lastName: profile.last_name || prev.lastName,
        phone: profile.phone || prev.phone,
      }));
    }
  }, [profile]);

  const saveOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Update profile via API client
      const { error: profileError } = await apiClient
        .from("profiles")
        .update({
          first_name: state.firstName,
          last_name: state.lastName,
          phone: state.phone,
        })
        .eq("user_id", user.id)
        .select("id");

      if (profileError) throw profileError;

      // Notification preferences: insert via API client (skip upsert complexity for now)
      try {
        await apiClient
          .from("patient_notification_preferences")
          .insert({
            user_id: user.id,
            email_reminders: state.emailEnabled,
            email_missed_alerts: state.emailEnabled,
            email_encouragements: state.emailEnabled,
            in_app_reminders: state.pushEnabled,
            in_app_missed_alerts: state.pushEnabled,
            in_app_encouragements: state.pushEnabled,
            quiet_hours_enabled: state.quietHoursEnabled,
            quiet_hours_start: state.quietHoursStart,
            quiet_hours_end: state.quietHoursEnd,
          })
          .select("id")
          .single();
      } catch (e) {
        // Non-fatal: notification preferences can be configured later
        console.warn("[Onboarding] Could not save notification preferences:", e);
      }
    },
    onSuccess: async () => {
      // Refresh auth profile so the onboarding-status check sees updated first_name
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["patient-notification-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      toast.success("Setup complete! Welcome to Pillaxia.");
      onComplete?.();
    },
    onError: (error) => {
      console.error("Onboarding failed:", error);
      toast.error("Something went wrong. Please try again.");
    },
  });

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      saveOnboardingMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    saveOnboardingMutation.mutate();
  };

  if (isLoading || hasCompletedOnboarding) {
    return null;
  }

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case "welcome":
        return <WelcomeStep />;
      case "profile":
        return <ProfileStep state={state} setState={setState} />;
      case "notifications":
        return <NotificationsStep state={state} setState={setState} />;
      case "health":
        return <HealthStep navigate={navigate} />;
      case "complete":
        return <CompleteStep state={state} />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-xl">
        <div className="p-6 pb-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                    index === currentStep
                      ? "bg-primary text-primary-foreground scale-110"
                      : index < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index < currentStep ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between mt-2">
            <CardTitle>{STEPS[currentStep].title}</CardTitle>
            <Badge variant="secondary">
              {currentStep + 1} of {STEPS.length}
            </Badge>
          </div>
        </div>

        <CardContent>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <div>
              {currentStep > 0 && currentStep < STEPS.length - 1 && (
                <Button variant="ghost" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {currentStep < STEPS.length - 1 && currentStep > 0 && (
                <Button variant="ghost" onClick={handleSkip}>
                  Skip for now
                </Button>
              )}
              <Button onClick={handleNext} disabled={saveOnboardingMutation.isPending}>
                {currentStep === STEPS.length - 1 ? (
                  saveOnboardingMutation.isPending ? (
                    "Finishing..."
                  ) : (
                    <>
                      Get Started
                      <Sparkles className="h-4 w-4 ml-1" />
                    </>
                  )
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="text-center space-y-4 py-4">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
        <Pill className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-semibold">Welcome to Pillaxia!</h2>
      <p className="text-muted-foreground">
        Let's take a minute to set up your account so you can get the most out
        of your medication management experience.
      </p>
      <div className="grid grid-cols-3 gap-4 pt-4">
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">Track Meds</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">Get Reminders</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground">Stay Safe</p>
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  state: OnboardingState;
  setState: React.Dispatch<React.SetStateAction<OnboardingState>>;
}

function ProfileStep({ state, setState }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tell us a bit about yourself
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>First Name</Label>
          <Input
            placeholder="John"
            value={state.firstName}
            onChange={(e) => setState({ ...state, firstName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Last Name</Label>
          <Input
            placeholder="Doe"
            value={state.lastName}
            onChange={(e) => setState({ ...state, lastName: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Phone Number (optional)</Label>
        <Input
          type="tel"
          placeholder="+234 800 000 0000"
          value={state.phone}
          onChange={(e) => setState({ ...state, phone: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Required for SMS and WhatsApp notifications
        </p>
      </div>
    </div>
  );
}

function NotificationsStep({ state, setState }: StepProps) {
  const channels = [
    {
      key: "emailEnabled" as const,
      icon: Mail,
      title: "Email",
      description: "Daily digests and important alerts",
    },
    {
      key: "pushEnabled" as const,
      icon: Smartphone,
      title: "Push Notifications",
      description: "Browser notifications",
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Choose how you'd like to receive reminders
      </p>
      <div className="space-y-3">
        {channels.map((channel) => {
          const Icon = channel.icon;
          
          return (
            <div
              key={channel.key}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{channel.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {channel.description}
                  </p>
                </div>
              </div>
              <Switch
                checked={state[channel.key]}
                onCheckedChange={(checked) =>
                  setState({ ...state, [channel.key]: checked })
                }
              />
            </div>
          );
        })}
      </div>

      <Separator />

      <div className="flex items-center justify-between p-3 rounded-lg border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Moon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">Quiet Hours</p>
            <p className="text-xs text-muted-foreground">
              Pause notifications during sleep
            </p>
          </div>
        </div>
        <Switch
          checked={state.quietHoursEnabled}
          onCheckedChange={(checked) =>
            setState({ ...state, quietHoursEnabled: checked })
          }
        />
      </div>

      {state.quietHoursEnabled && (
        <div className="flex items-center gap-4 pl-12">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input
              type="time"
              value={state.quietHoursStart}
              onChange={(e) =>
                setState({ ...state, quietHoursStart: e.target.value })
              }
              className="w-28"
            />
          </div>
          <span className="text-muted-foreground">to</span>
          <Input
            type="time"
            value={state.quietHoursEnd}
            onChange={(e) =>
              setState({ ...state, quietHoursEnd: e.target.value })
            }
            className="w-28"
          />
        </div>
      )}
    </div>
  );
}

function HealthStep({ navigate }: { navigate: (path: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Help us provide better medication safety checks
      </p>

      <Card
        className="cursor-pointer hover:border-primary transition-colors"
        onClick={() => navigate("/dashboard/health")}
      >
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
              <Shield className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-medium">Allergies & Conditions</p>
              <p className="text-xs text-muted-foreground">
                Add after setup in Health Profile
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>

      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Why this matters</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Check for drug allergies before adding medications</li>
          <li>Identify potential drug-condition interactions</li>
          <li>Provide better recommendations from Angela AI</li>
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        You can always update this information later in your Health Profile.
      </p>
    </div>
  );
}

function CompleteStep({ state }: { state: OnboardingState }) {
  const enabledChannels = [
    state.emailEnabled && "Email",
    state.pushEnabled && "Push",
  ].filter(Boolean);

  return (
    <div className="text-center space-y-4 py-4">
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-semibold">You're all set!</h2>
      <p className="text-muted-foreground">
        Your account is ready. Here's what we've set up:
      </p>

      <div className="text-left bg-muted/50 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <span className="text-sm">
            <strong>Profile:</strong>{" "}
            {state.firstName || state.lastName
              ? `${state.firstName} ${state.lastName}`.trim()
              : "Not set"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-sm">
            <strong>Notifications:</strong>{" "}
            {enabledChannels.length > 0 ? enabledChannels.join(", ") : "None"}
          </span>
        </div>
        {state.quietHoursEnabled && (
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-primary" />
            <span className="text-sm">
              <strong>Quiet Hours:</strong> {state.quietHoursStart} -{" "}
              {state.quietHoursEnd}
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        You can change these settings anytime in your Settings page.
      </p>
    </div>
  );
}
