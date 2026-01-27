import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Mail,
  Smartphone,
  MessageSquare,
  Phone,
  Moon,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationSetupWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

interface WizardPreferences {
  // Email
  email_reminders: boolean;
  email_missed_alerts: boolean;
  email_encouragements: boolean;
  email_clinician_messages: boolean;
  // SMS
  sms_reminders: boolean;
  sms_clinician_messages: boolean;
  // WhatsApp
  whatsapp_reminders: boolean;
  whatsapp_clinician_messages: boolean;
  // Push
  in_app_reminders: boolean;
  in_app_missed_alerts: boolean;
  in_app_encouragements: boolean;
  push_clinician_messages: boolean;
  // Quiet hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

const STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "email", title: "Email", icon: Mail },
  { id: "sms", title: "SMS", icon: Phone },
  { id: "whatsapp", title: "WhatsApp", icon: MessageSquare },
  { id: "push", title: "Push", icon: Smartphone },
  { id: "quiet", title: "Quiet Hours", icon: Moon },
  { id: "review", title: "Review", icon: Check },
];

const DEFAULT_PREFERENCES: WizardPreferences = {
  email_reminders: true,
  email_missed_alerts: true,
  email_encouragements: true,
  email_clinician_messages: true,
  sms_reminders: true,
  sms_clinician_messages: true,
  whatsapp_reminders: true,
  whatsapp_clinician_messages: true,
  in_app_reminders: true,
  in_app_missed_alerts: true,
  in_app_encouragements: true,
  push_clinician_messages: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
};

export function NotificationSetupWizard({
  open,
  onOpenChange,
  onComplete,
}: NotificationSetupWizardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<WizardPreferences>(DEFAULT_PREFERENCES);
  const [phoneNumber, setPhoneNumber] = useState("");

  const progress = ((currentStep + 1) / STEPS.length) * 100;

  const savePreferencesMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // First, upsert notification preferences
      const { error: prefsError } = await supabase
        .from("patient_notification_preferences")
        .upsert({
          user_id: user.id,
          ...preferences,
        }, { onConflict: "user_id" });

      if (prefsError) throw prefsError;

      // If phone number provided, update profile
      if (phoneNumber.trim()) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ phone: phoneNumber.trim() })
          .eq("user_id", user.id);

        if (profileError) throw profileError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-notification-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Notification preferences saved!");
      onOpenChange(false);
      onComplete?.();
    },
    onError: (error) => {
      console.error("Failed to save preferences:", error);
      toast.error("Failed to save preferences. Please try again.");
    },
  });

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      savePreferencesMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updatePreference = <K extends keyof WizardPreferences>(
    key: K,
    value: WizardPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const enableAllChannel = (channel: "email" | "sms" | "whatsapp" | "push") => {
    switch (channel) {
      case "email":
        setPreferences((prev) => ({
          ...prev,
          email_reminders: true,
          email_missed_alerts: true,
          email_encouragements: true,
          email_clinician_messages: true,
        }));
        break;
      case "sms":
        setPreferences((prev) => ({
          ...prev,
          sms_reminders: true,
          sms_clinician_messages: true,
        }));
        break;
      case "whatsapp":
        setPreferences((prev) => ({
          ...prev,
          whatsapp_reminders: true,
          whatsapp_clinician_messages: true,
        }));
        break;
      case "push":
        setPreferences((prev) => ({
          ...prev,
          in_app_reminders: true,
          in_app_missed_alerts: true,
          in_app_encouragements: true,
          push_clinician_messages: true,
        }));
        break;
    }
  };

  const disableAllChannel = (channel: "email" | "sms" | "whatsapp" | "push") => {
    switch (channel) {
      case "email":
        setPreferences((prev) => ({
          ...prev,
          email_reminders: false,
          email_missed_alerts: false,
          email_encouragements: false,
          email_clinician_messages: false,
        }));
        break;
      case "sms":
        setPreferences((prev) => ({
          ...prev,
          sms_reminders: false,
          sms_clinician_messages: false,
        }));
        break;
      case "whatsapp":
        setPreferences((prev) => ({
          ...prev,
          whatsapp_reminders: false,
          whatsapp_clinician_messages: false,
        }));
        break;
      case "push":
        setPreferences((prev) => ({
          ...prev,
          in_app_reminders: false,
          in_app_missed_alerts: false,
          in_app_encouragements: false,
          push_clinician_messages: false,
        }));
        break;
    }
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case "welcome":
        return <WelcomeStep />;
      case "email":
        return (
          <ChannelStep
            channel="email"
            icon={Mail}
            title="Email Notifications"
            description="Receive notifications via email for important updates"
            preferences={preferences}
            updatePreference={updatePreference}
            enableAll={() => enableAllChannel("email")}
            disableAll={() => disableAllChannel("email")}
          />
        );
      case "sms":
        return (
          <SMSStep
            preferences={preferences}
            updatePreference={updatePreference}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            enableAll={() => enableAllChannel("sms")}
            disableAll={() => disableAllChannel("sms")}
          />
        );
      case "whatsapp":
        return (
          <ChannelStep
            channel="whatsapp"
            icon={MessageSquare}
            title="WhatsApp Notifications"
            description="Get reminders and messages through WhatsApp"
            preferences={preferences}
            updatePreference={updatePreference}
            enableAll={() => enableAllChannel("whatsapp")}
            disableAll={() => disableAllChannel("whatsapp")}
            phoneRequired={!phoneNumber}
          />
        );
      case "push":
        return (
          <ChannelStep
            channel="push"
            icon={Smartphone}
            title="Push Notifications"
            description="Receive instant notifications in your browser"
            preferences={preferences}
            updatePreference={updatePreference}
            enableAll={() => enableAllChannel("push")}
            disableAll={() => disableAllChannel("push")}
          />
        );
      case "quiet":
        return (
          <QuietHoursStep
            preferences={preferences}
            updatePreference={updatePreference}
          />
        );
      case "review":
        return <ReviewStep preferences={preferences} phoneNumber={phoneNumber} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                    index === currentStep
                      ? "bg-primary text-primary-foreground"
                      : index < currentStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={progress} className="h-1.5" />
          <DialogTitle className="mt-4">{STEPS[currentStep].title}</DialogTitle>
          <DialogDescription>
            Step {currentStep + 1} of {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">{renderStepContent()}</div>

        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={savePreferencesMutation.isPending}
          >
            {currentStep === STEPS.length - 1 ? (
              savePreferencesMutation.isPending ? (
                "Saving..."
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Complete Setup
                </>
              )
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WelcomeStep() {
  return (
    <div className="space-y-4 text-center py-4">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
        <Bell className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">
        Let's set up your notifications
      </h3>
      <p className="text-muted-foreground">
        We'll help you configure how you'd like to receive medication reminders,
        alerts, and messages from your care team.
      </p>
      <div className="grid grid-cols-2 gap-3 pt-4">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Email</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">SMS</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">WhatsApp</span>
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Push</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface ChannelStepProps {
  channel: "email" | "sms" | "whatsapp" | "push";
  icon: React.ElementType;
  title: string;
  description: string;
  preferences: WizardPreferences;
  updatePreference: <K extends keyof WizardPreferences>(
    key: K,
    value: WizardPreferences[K]
  ) => void;
  enableAll: () => void;
  disableAll: () => void;
  phoneRequired?: boolean;
}

function ChannelStep({
  channel,
  icon: Icon,
  title,
  description,
  preferences,
  updatePreference,
  enableAll,
  disableAll,
  phoneRequired,
}: ChannelStepProps) {
  const getOptions = () => {
    switch (channel) {
      case "email":
        return [
          { key: "email_reminders" as const, label: "Medication reminders" },
          { key: "email_missed_alerts" as const, label: "Missed dose alerts" },
          { key: "email_encouragements" as const, label: "Encouragement messages" },
          { key: "email_clinician_messages" as const, label: "Clinician messages" },
        ];
      case "whatsapp":
        return [
          { key: "whatsapp_reminders" as const, label: "Medication reminders" },
          { key: "whatsapp_clinician_messages" as const, label: "Clinician messages" },
        ];
      case "push":
        return [
          { key: "in_app_reminders" as const, label: "Medication reminders" },
          { key: "in_app_missed_alerts" as const, label: "Missed dose alerts" },
          { key: "in_app_encouragements" as const, label: "Encouragement messages" },
          { key: "push_clinician_messages" as const, label: "Clinician messages" },
        ];
      default:
        return [];
    }
  };

  const options = getOptions();
  const allEnabled = options.every((opt) => preferences[opt.key]);
  const someEnabled = options.some((opt) => preferences[opt.key]);

  if (phoneRequired && channel === "whatsapp") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground text-center">
              Add a phone number in the SMS step to enable WhatsApp notifications
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={allEnabled ? "default" : "outline"}
          size="sm"
          onClick={enableAll}
        >
          Enable All
        </Button>
        <Button
          variant={!someEnabled ? "default" : "outline"}
          size="sm"
          onClick={disableAll}
        >
          Disable All
        </Button>
      </div>

      <div className="space-y-3">
        {options.map((option) => (
          <div
            key={option.key}
            className="flex items-center justify-between p-3 rounded-lg border bg-card"
          >
            <Label htmlFor={option.key} className="cursor-pointer">
              {option.label}
            </Label>
            <Switch
              id={option.key}
              checked={preferences[option.key]}
              onCheckedChange={(checked) => updatePreference(option.key, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface SMSStepProps {
  preferences: WizardPreferences;
  updatePreference: <K extends keyof WizardPreferences>(
    key: K,
    value: WizardPreferences[K]
  ) => void;
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
  enableAll: () => void;
  disableAll: () => void;
}

function SMSStep({
  preferences,
  updatePreference,
  phoneNumber,
  setPhoneNumber,
  enableAll,
  disableAll,
}: SMSStepProps) {
  const options = [
    { key: "sms_reminders" as const, label: "Medication reminders" },
    { key: "sms_clinician_messages" as const, label: "Clinician messages" },
  ];

  const allEnabled = options.every((opt) => preferences[opt.key]);
  const someEnabled = options.some((opt) => preferences[opt.key]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <Phone className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">SMS Notifications</h3>
          <p className="text-sm text-muted-foreground">
            Receive text messages for reminders and alerts
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1 (555) 000-0000"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Required for SMS and WhatsApp notifications
        </p>
      </div>

      <Separator />

      <div className="flex gap-2">
        <Button
          variant={allEnabled ? "default" : "outline"}
          size="sm"
          onClick={enableAll}
        >
          Enable All
        </Button>
        <Button
          variant={!someEnabled ? "default" : "outline"}
          size="sm"
          onClick={disableAll}
        >
          Disable All
        </Button>
      </div>

      <div className="space-y-3">
        {options.map((option) => (
          <div
            key={option.key}
            className="flex items-center justify-between p-3 rounded-lg border bg-card"
          >
            <Label htmlFor={option.key} className="cursor-pointer">
              {option.label}
            </Label>
            <Switch
              id={option.key}
              checked={preferences[option.key]}
              onCheckedChange={(checked) => updatePreference(option.key, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface QuietHoursStepProps {
  preferences: WizardPreferences;
  updatePreference: <K extends keyof WizardPreferences>(
    key: K,
    value: WizardPreferences[K]
  ) => void;
}

function QuietHoursStep({ preferences, updatePreference }: QuietHoursStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <Moon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Quiet Hours</h3>
          <p className="text-sm text-muted-foreground">
            Pause notifications during sleep or rest times
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <Label htmlFor="quiet-hours" className="cursor-pointer font-medium">
              Enable Quiet Hours
            </Label>
            <p className="text-sm text-muted-foreground">
              Notifications will be silenced during these hours
            </p>
          </div>
        </div>
        <Switch
          id="quiet-hours"
          checked={preferences.quiet_hours_enabled}
          onCheckedChange={(checked) =>
            updatePreference("quiet_hours_enabled", checked)
          }
        />
      </div>

      {preferences.quiet_hours_enabled && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={preferences.quiet_hours_start}
                  onChange={(e) =>
                    updatePreference("quiet_hours_start", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={preferences.quiet_hours_end}
                  onChange={(e) =>
                    updatePreference("quiet_hours_end", e.target.value)
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Notifications from {preferences.quiet_hours_start} to{" "}
              {preferences.quiet_hours_end} will be silenced
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ReviewStepProps {
  preferences: WizardPreferences;
  phoneNumber: string;
}

function ReviewStep({ preferences, phoneNumber }: ReviewStepProps) {
  const channels = [
    {
      name: "Email",
      icon: Mail,
      enabled: [
        preferences.email_reminders,
        preferences.email_missed_alerts,
        preferences.email_encouragements,
        preferences.email_clinician_messages,
      ],
    },
    {
      name: "SMS",
      icon: Phone,
      enabled: [preferences.sms_reminders, preferences.sms_clinician_messages],
      requiresPhone: true,
    },
    {
      name: "WhatsApp",
      icon: MessageSquare,
      enabled: [
        preferences.whatsapp_reminders,
        preferences.whatsapp_clinician_messages,
      ],
      requiresPhone: true,
    },
    {
      name: "Push",
      icon: Smartphone,
      enabled: [
        preferences.in_app_reminders,
        preferences.in_app_missed_alerts,
        preferences.in_app_encouragements,
        preferences.push_clinician_messages,
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <Check className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Review Your Settings</h3>
          <p className="text-sm text-muted-foreground">
            Here's a summary of your notification preferences
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const enabledCount = channel.enabled.filter(Boolean).length;
          const totalCount = channel.enabled.length;
          const hasPhone = !!phoneNumber.trim();
          const isActive =
            enabledCount > 0 && (!channel.requiresPhone || hasPhone);

          return (
            <Card
              key={channel.name}
              className={cn(
                "transition-colors",
                isActive ? "border-primary/30 bg-primary/5" : "border-muted"
              )}
            >
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                  <span className="font-medium">{channel.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {channel.requiresPhone && !hasPhone ? (
                    <Badge variant="outline" className="text-muted-foreground">
                      No phone
                    </Badge>
                  ) : (
                    <Badge variant={isActive ? "default" : "secondary"}>
                      {enabledCount}/{totalCount} enabled
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {preferences.quiet_hours_enabled && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-3">
            <Moon className="h-5 w-5 text-primary" />
            <div>
              <span className="font-medium">Quiet Hours</span>
              <p className="text-sm text-muted-foreground">
                {preferences.quiet_hours_start} - {preferences.quiet_hours_end}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {phoneNumber && (
        <p className="text-sm text-muted-foreground text-center">
          Phone: {phoneNumber}
        </p>
      )}
    </div>
  );
}
