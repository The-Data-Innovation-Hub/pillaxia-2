import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin, Star, Plus, Trash2, Search, Bell, BellOff, Map } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { PharmacyMapView } from "./PharmacyMapView";

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

interface PharmacyLocation {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  state: string;
  phone: string | null;
}

interface PreferredPharmacy {
  id: string;
  pharmacy_id: string;
  is_primary: boolean;
  pharmacy_locations: PharmacyLocation;
}

interface MedicationAlert {
  id: string;
  medication_name: string;
  is_active: boolean;
  notify_email: boolean;
  notify_sms: boolean;
  notify_whatsapp: boolean;
  notify_push: boolean;
}

export function PharmacyPreferencesCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [newAlertName, setNewAlertName] = useState("");

  // Fetch preferred pharmacies
  const { data: preferredPharmacies, isLoading: loadingPreferred } = useQuery({
    queryKey: ["patient-preferred-pharmacies", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_preferred_pharmacies")
        .select(`
          id,
          pharmacy_id,
          is_primary,
          pharmacy_locations (
            id, name, address_line1, city, state, phone
          )
        `)
        .eq("patient_user_id", user?.id);
      if (error) throw error;
      return data as unknown as PreferredPharmacy[];
    },
    enabled: !!user?.id,
  });

  // Fetch all pharmacies (always load for map view)
  const { data: allPharmacies, isLoading: loadingPharmacies } = useQuery({
    queryKey: ["all-pharmacies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_locations")
        .select("id, name, address_line1, city, state, phone")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as PharmacyLocation[];
    },
    enabled: !!user?.id,
  });

  // Filter pharmacies for dialog based on state
  const dialogFilteredPharmacies = allPharmacies?.filter((p) => {
    if (!stateFilter) return true;
    return p.state === stateFilter;
  });

  // Fetch medication alerts
  const { data: medicationAlerts, isLoading: loadingAlerts } = useQuery({
    queryKey: ["medication-alerts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medication_availability_alerts")
        .select("*")
        .eq("patient_user_id", user?.id)
        .order("medication_name");
      if (error) throw error;
      return data as MedicationAlert[];
    },
    enabled: !!user?.id,
  });

  // Add preferred pharmacy
  const addPreferredMutation = useMutation({
    mutationFn: async (pharmacyId: string) => {
      const { error } = await supabase.from("patient_preferred_pharmacies").insert({
        patient_user_id: user?.id,
        pharmacy_id: pharmacyId,
        is_primary: !preferredPharmacies?.length, // First one is primary
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-preferred-pharmacies"] });
      toast.success("Pharmacy added to your preferences");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("This pharmacy is already in your preferences");
      } else {
        toast.error("Failed to add pharmacy", { description: error.message });
      }
    },
  });

  // Remove preferred pharmacy
  const removePreferredMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("patient_preferred_pharmacies")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-preferred-pharmacies"] });
      toast.success("Pharmacy removed from preferences");
    },
    onError: (error: Error) => {
      toast.error("Failed to remove pharmacy", { description: error.message });
    },
  });

  // Set primary pharmacy
  const setPrimaryMutation = useMutation({
    mutationFn: async (id: string) => {
      // First, unset all primaries
      await supabase
        .from("patient_preferred_pharmacies")
        .update({ is_primary: false })
        .eq("patient_user_id", user?.id);
      
      // Then set the new primary
      const { error } = await supabase
        .from("patient_preferred_pharmacies")
        .update({ is_primary: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-preferred-pharmacies"] });
      toast.success("Primary pharmacy updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update primary pharmacy", { description: error.message });
    },
  });

  // Add medication alert
  const addAlertMutation = useMutation({
    mutationFn: async (medicationName: string) => {
      const { error } = await supabase.from("medication_availability_alerts").insert({
        patient_user_id: user?.id,
        medication_name: medicationName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medication-alerts"] });
      setNewAlertName("");
      toast.success("Alert subscription added");
    },
    onError: (error: Error) => {
      toast.error("Failed to add alert", { description: error.message });
    },
  });

  // Toggle alert
  const toggleAlertMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("medication_availability_alerts")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medication-alerts"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to toggle alert", { description: error.message });
    },
  });

  // Delete alert
  const deleteAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("medication_availability_alerts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medication-alerts"] });
      toast.success("Alert removed");
    },
    onError: (error: Error) => {
      toast.error("Failed to remove alert", { description: error.message });
    },
  });

  const filteredPharmacies = dialogFilteredPharmacies?.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase());
    const notAlreadyAdded = !preferredPharmacies?.some(
      (pp) => pp.pharmacy_id === p.id
    );
    return matchesSearch && notAlreadyAdded;
  });

  const preferredPharmacyIds = preferredPharmacies?.map((pp) => pp.pharmacy_id) || [];

  return (
    <div className="space-y-6">
      {/* Map View */}
      {allPharmacies && allPharmacies.length > 0 && (
        <PharmacyMapView
          pharmacies={allPharmacies}
          preferredPharmacyIds={preferredPharmacyIds}
          onSelectPharmacy={(pharmacy) => {
            if (!preferredPharmacyIds.includes(pharmacy.id)) {
              addPreferredMutation.mutate(pharmacy.id);
            }
          }}
        />
      )}

      {/* Preferred Pharmacies */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              My Preferred Pharmacies
            </CardTitle>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Pharmacy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Find a Pharmacy in Nigeria</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="flex gap-3">
                    <Select value={stateFilter} onValueChange={setStateFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All states" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
                        <SelectItem value="">All states</SelectItem>
                        {NIGERIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or city..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {loadingPharmacies ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : !filteredPharmacies?.length ? (
                      <p className="text-center text-muted-foreground py-4">
                        No pharmacies found
                      </p>
                    ) : (
                      filteredPharmacies.map((pharmacy) => (
                        <div
                          key={pharmacy.id}
                          className="p-3 rounded-lg border flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium">{pharmacy.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {pharmacy.address_line1}, {pharmacy.city}, {pharmacy.state}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addPreferredMutation.mutate(pharmacy.id)}
                            disabled={addPreferredMutation.isPending}
                          >
                            Add
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPreferred ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !preferredPharmacies?.length ? (
            <p className="text-muted-foreground text-center py-4">
              No preferred pharmacies yet. Add pharmacies to receive availability alerts.
            </p>
          ) : (
            <div className="space-y-3">
              {preferredPharmacies.map((pp) => (
                <div
                  key={pp.id}
                  className="p-4 rounded-lg border flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {pp.is_primary && (
                      <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                    )}
                    <div>
                      <p className="font-medium">{pp.pharmacy_locations.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {pp.pharmacy_locations.city}, {pp.pharmacy_locations.state}
                      </p>
                      {pp.pharmacy_locations.phone && (
                        <p className="text-sm text-muted-foreground">
                          {pp.pharmacy_locations.phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!pp.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPrimaryMutation.mutate(pp.id)}
                        disabled={setPrimaryMutation.isPending}
                      >
                        Set Primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePreferredMutation.mutate(pp.id)}
                      disabled={removePreferredMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medication Availability Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Medication Availability Alerts
            </CardTitle>
            <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Alert
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Subscribe to Availability Alert</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Get notified when this medication becomes available at your preferred pharmacies.
                  </p>
                  <div className="space-y-2">
                    <Label>Medication Name</Label>
                    <Input
                      value={newAlertName}
                      onChange={(e) => setNewAlertName(e.target.value)}
                      placeholder="e.g., Metformin 500mg"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      addAlertMutation.mutate(newAlertName);
                      setShowAlertDialog(false);
                    }}
                    disabled={!newAlertName.trim() || addAlertMutation.isPending}
                    className="w-full"
                  >
                    {addAlertMutation.isPending ? "Adding..." : "Subscribe to Alert"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAlerts ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !medicationAlerts?.length ? (
            <p className="text-muted-foreground text-center py-4">
              No medication alerts set up. Add alerts for medications you need.
            </p>
          ) : (
            <div className="space-y-3">
              {medicationAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 rounded-lg border flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {alert.is_active ? (
                      <Bell className="h-5 w-5 text-primary" />
                    ) : (
                      <BellOff className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{alert.medication_name}</p>
                      <div className="flex gap-2 mt-1">
                        {alert.notify_email && <Badge variant="outline" className="text-xs">Email</Badge>}
                        {alert.notify_sms && <Badge variant="outline" className="text-xs">SMS</Badge>}
                        {alert.notify_whatsapp && <Badge variant="outline" className="text-xs">WhatsApp</Badge>}
                        {alert.notify_push && <Badge variant="outline" className="text-xs">Push</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={alert.is_active}
                      onCheckedChange={(checked) =>
                        toggleAlertMutation.mutate({ id: alert.id, isActive: !!checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteAlertMutation.mutate(alert.id)}
                      disabled={deleteAlertMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
