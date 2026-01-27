import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Globe2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Common timezones organized by region - focusing on African timezones first for Nigerian market
const TIMEZONES = [
  // Africa
  { value: "Africa/Lagos", label: "Lagos (WAT)", region: "Africa" },
  { value: "Africa/Accra", label: "Accra (GMT)", region: "Africa" },
  { value: "Africa/Cairo", label: "Cairo (EET)", region: "Africa" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)", region: "Africa" },
  { value: "Africa/Nairobi", label: "Nairobi (EAT)", region: "Africa" },
  { value: "Africa/Casablanca", label: "Casablanca (WET)", region: "Africa" },
  
  // Europe
  { value: "Europe/London", label: "London (GMT/BST)", region: "Europe" },
  { value: "Europe/Paris", label: "Paris (CET)", region: "Europe" },
  { value: "Europe/Berlin", label: "Berlin (CET)", region: "Europe" },
  { value: "Europe/Moscow", label: "Moscow (MSK)", region: "Europe" },
  
  // Americas
  { value: "America/New_York", label: "New York (EST/EDT)", region: "Americas" },
  { value: "America/Chicago", label: "Chicago (CST/CDT)", region: "Americas" },
  { value: "America/Denver", label: "Denver (MST/MDT)", region: "Americas" },
  { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)", region: "Americas" },
  { value: "America/Toronto", label: "Toronto (EST/EDT)", region: "Americas" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)", region: "Americas" },
  
  // Asia
  { value: "Asia/Dubai", label: "Dubai (GST)", region: "Asia" },
  { value: "Asia/Kolkata", label: "Mumbai/Delhi (IST)", region: "Asia" },
  { value: "Asia/Singapore", label: "Singapore (SGT)", region: "Asia" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)", region: "Asia" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)", region: "Asia" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)", region: "Asia" },
  
  // Pacific
  { value: "Australia/Sydney", label: "Sydney (AEST)", region: "Pacific" },
  { value: "Australia/Melbourne", label: "Melbourne (AEST)", region: "Pacific" },
  { value: "Pacific/Auckland", label: "Auckland (NZST)", region: "Pacific" },
  
  // UTC
  { value: "UTC", label: "UTC (Coordinated Universal Time)", region: "UTC" },
];

// Group timezones by region
const groupedTimezones = TIMEZONES.reduce((acc, tz) => {
  if (!acc[tz.region]) {
    acc[tz.region] = [];
  }
  acc[tz.region].push(tz);
  return acc;
}, {} as Record<string, typeof TIMEZONES>);

export function TimezoneSelector() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);

  // Detect user's timezone on mount
  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDetectedTimezone(detected);
    } catch {
      setDetectedTimezone("UTC");
    }
  }, []);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-timezone", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("timezone")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateTimezoneMutation = useMutation({
    mutationFn: async (timezone: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("profiles")
        .update({ timezone })
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-timezone"] });
      toast({
        title: "Timezone updated",
        description: "Your daily digest emails will be sent at 8am in your local time.",
      });
    },
    onError: (error) => {
      console.error("Failed to update timezone:", error);
      toast({
        title: "Failed to save",
        description: "Could not update your timezone. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTimezoneChange = (value: string) => {
    updateTimezoneMutation.mutate(value);
  };

  const handleUseDetected = () => {
    if (detectedTimezone) {
      updateTimezoneMutation.mutate(detectedTimezone);
    }
  };

  const currentTimezone = profile?.timezone || "UTC";
  const currentTime = new Date().toLocaleTimeString("en-US", {
    timeZone: currentTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Check if detected timezone is in our list
  const isDetectedInList = TIMEZONES.some(tz => tz.value === detectedTimezone);
  const showDetectedSuggestion = detectedTimezone && 
    isDetectedInList && 
    detectedTimezone !== currentTimezone;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe2 className="h-5 w-5 text-primary" />
          Timezone Settings
        </CardTitle>
        <CardDescription>
          Set your timezone for daily digest emails at 8am local time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label className="font-medium">Your Timezone</Label>
              <p className="text-sm text-muted-foreground">
                Current local time: {currentTime}
              </p>
            </div>
          </div>
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Select
              value={currentTimezone}
              onValueChange={handleTimezoneChange}
              disabled={updateTimezoneMutation.isPending}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50 max-h-80">
                {Object.entries(groupedTimezones).map(([region, zones]) => (
                  <div key={region}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                      {region}
                    </div>
                    {zones.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {showDetectedSuggestion && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="text-sm">
              <p className="font-medium">Detected timezone: {detectedTimezone}</p>
              <p className="text-muted-foreground">Would you like to use this instead?</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUseDetected}
              disabled={updateTimezoneMutation.isPending}
            >
              {updateTimezoneMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Use Detected
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Daily digest emails summarizing your medication adherence will be sent at 8:00 AM in your selected timezone.
        </p>
      </CardContent>
    </Card>
  );
}
