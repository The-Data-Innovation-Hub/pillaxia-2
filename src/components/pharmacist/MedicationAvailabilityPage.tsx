import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MapPin, Package, Search, Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  is_active: boolean;
}

interface MedicationCatalogEntry {
  id: string;
  name: string;
  generic_name: string | null;
  dosage: string | null;
  form: string | null;
}

interface MedicationAvailability {
  id: string;
  pharmacy_id: string;
  medication_catalog_id: string;
  medication_catalog: MedicationCatalogEntry | null;
  is_available: boolean;
  quantity_available: number | null;
  price_naira: number | null;
  notes: string | null;
  updated_at: string;
}

export function MedicationAvailabilityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showPharmacyDialog, setShowPharmacyDialog] = useState(false);
  const [showMedicationDialog, setShowMedicationDialog] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | null>(null);
  const [isSendingAlerts, setIsSendingAlerts] = useState(false);

  // Form states for new pharmacy
  const [pharmacyForm, setPharmacyForm] = useState({
    name: "",
    address_line1: "",
    city: "",
    state: "",
    phone: "",
  });

  // Form states for new medication availability
  const [medicationForm, setMedicationForm] = useState({
    medication_catalog_id: "",
    quantity_available: "",
    price_naira: "",
    notes: "",
  });

  // Fetch medication catalog for the selector
  const { data: catalogItems } = useQuery({
    queryKey: ["medication-catalog-for-availability"],
    queryFn: async () => {
      const { data, error } = await db
        .from("medication_catalog")
        .select("id, name, generic_name, dosage, form")
        .order("name");
      if (error) throw error;
      return data as MedicationCatalogEntry[];
    },
  });

  // Fetch pharmacies owned by this pharmacist
  const { data: pharmacies, isLoading: loadingPharmacies } = useQuery({
    queryKey: ["pharmacist-pharmacies", user?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("pharmacy_locations")
        .select("*")
        .eq("pharmacist_user_id", user?.id)
        .order("name");
      if (error) throw error;
      return data as PharmacyLocation[];
    },
    enabled: !!user?.id,
  });

  // Fetch medication availability for selected pharmacy (with catalog join)
  const { data: medications, isLoading: loadingMedications } = useQuery({
    queryKey: ["pharmacy-medications", selectedPharmacy],
    queryFn: async () => {
      const { data, error } = await db
        .from("medication_availability")
        .select(`
          *,
          medication_catalog (id, name, generic_name, dosage, form)
        `)
        .eq("pharmacy_id", selectedPharmacy)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as MedicationAvailability[];
    },
    enabled: !!selectedPharmacy,
  });

  // Create pharmacy mutation
  const createPharmacyMutation = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("pharmacy_locations").insert({
        pharmacist_user_id: user?.id,
        name: pharmacyForm.name,
        address_line1: pharmacyForm.address_line1,
        city: pharmacyForm.city,
        state: pharmacyForm.state,
        phone: pharmacyForm.phone || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacist-pharmacies"] });
      setShowPharmacyDialog(false);
      setPharmacyForm({ name: "", address_line1: "", city: "", state: "", phone: "" });
      toast.success("Pharmacy location added");
    },
    onError: (error: Error) => {
      toast.error("Failed to add pharmacy", { description: error.message });
    },
  });

  // Create medication availability mutation
  const createMedicationMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await db.from("medication_availability").insert({
        pharmacy_id: selectedPharmacy,
        medication_catalog_id: medicationForm.medication_catalog_id,
        quantity_available: medicationForm.quantity_available ? parseInt(medicationForm.quantity_available) : null,
        price_naira: medicationForm.price_naira ? parseFloat(medicationForm.price_naira) : null,
        notes: medicationForm.notes || null,
        is_available: true,
        last_updated_by: user?.id,
      }).select(`
        *,
        medication_catalog (id, name, generic_name, dosage, form)
      `).single();
      if (error) throw error;
      return data as unknown as MedicationAvailability;
    },
    onSuccess: async (newMedication) => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-medications"] });
      setShowMedicationDialog(false);
      setMedicationForm({
        medication_catalog_id: "",
        quantity_available: "",
        price_naira: "",
        notes: "",
      });
      toast.success("Medication availability updated");
      
      // Trigger availability alerts
      const medName = newMedication.medication_catalog?.name || "Unknown";
      await triggerAvailabilityAlerts(newMedication.id, medName);
    },
    onError: (error: Error) => {
      toast.error("Failed to add medication", { description: error.message });
    },
  });

  // Toggle availability mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      const { data, error } = await db
        .from("medication_availability")
        .update({ is_available: isAvailable, last_updated_by: user?.id })
        .eq("id", id)
        .select(`
          *,
          medication_catalog (id, name, generic_name, dosage, form)
        `)
        .single();
      if (error) throw error;
      return { data: data as unknown as MedicationAvailability, isAvailable };
    },
    onSuccess: async ({ data, isAvailable }) => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-medications"] });
      toast.success(isAvailable ? "Marked as available" : "Marked as unavailable");
      
      // Only trigger alerts when medication becomes available
      if (isAvailable) {
        const medName = data.medication_catalog?.name || "Unknown";
        await triggerAvailabilityAlerts(data.id, medName);
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to update availability", { description: error.message });
    },
  });

  const triggerAvailabilityAlerts = async (availabilityId: string, medicationName: string) => {
    setIsSendingAlerts(true);
    try {
      const { error } = await db.functions.invoke("send-availability-alert", {
        body: {
          availability_id: availabilityId,
          medication_name: medicationName,
          pharmacy_id: selectedPharmacy,
        },
      });
      if (error) console.error("Alert error:", error);
    } catch (err) {
      console.error("Failed to send alerts:", err);
    } finally {
      setIsSendingAlerts(false);
    }
  };

  const filteredMedications = medications?.filter((med) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = med.medication_catalog?.name?.toLowerCase() || "";
    const generic = med.medication_catalog?.generic_name?.toLowerCase() || "";
    return name.includes(q) || generic.includes(q);
  });

  const selectedPharmacyData = pharmacies?.find((p) => p.id === selectedPharmacy);

  const formatCatalogLabel = (item: MedicationCatalogEntry) => {
    const parts = [item.name];
    if (item.dosage) parts.push(item.dosage);
    if (item.form) parts.push(`(${item.form})`);
    if (item.generic_name) parts.push(`- ${item.generic_name}`);
    return parts.join(" ");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Medication Availability</h1>
          <p className="text-muted-foreground">
            Manage stock availability for local patients in Nigeria
          </p>
        </div>
        <Dialog open={showPharmacyDialog} onOpenChange={setShowPharmacyDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <MapPin className="h-4 w-4" />
              Add Pharmacy Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Pharmacy Location</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Pharmacy Name</Label>
                <Input
                  value={pharmacyForm.name}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, name: e.target.value })}
                  placeholder="e.g., HealthPlus Pharmacy"
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={pharmacyForm.address_line1}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, address_line1: e.target.value })}
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={pharmacyForm.city}
                    onChange={(e) => setPharmacyForm({ ...pharmacyForm, city: e.target.value })}
                    placeholder="e.g., Lagos"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select
                    value={pharmacyForm.state}
                    onValueChange={(value) => setPharmacyForm({ ...pharmacyForm, state: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
                      {NIGERIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input
                  value={pharmacyForm.phone}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, phone: e.target.value })}
                  placeholder="e.g., +234 800 000 0000"
                />
              </div>
              <Button
                onClick={() => createPharmacyMutation.mutate()}
                disabled={!pharmacyForm.name || !pharmacyForm.address_line1 || !pharmacyForm.city || !pharmacyForm.state || createPharmacyMutation.isPending}
                className="w-full"
              >
                {createPharmacyMutation.isPending ? "Adding..." : "Add Pharmacy"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pharmacy Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Your Pharmacy Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPharmacies ? (
            <div className="flex gap-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24 w-48" />
              ))}
            </div>
          ) : !pharmacies?.length ? (
            <p className="text-muted-foreground text-center py-4">
              No pharmacy locations added yet. Add your first location to start managing availability.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {pharmacies.map((pharmacy) => (
                <button
                  key={pharmacy.id}
                  onClick={() => setSelectedPharmacy(pharmacy.id)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedPharmacy === pharmacy.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium">{pharmacy.name}</p>
                  <p className="text-sm text-muted-foreground">{pharmacy.city}, {pharmacy.state}</p>
                  <Badge variant={pharmacy.is_active ? "outline" : "secondary"} className="mt-2">
                    {pharmacy.is_active ? "Active" : "Inactive"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medication Availability */}
      {selectedPharmacy && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Stock at {selectedPharmacyData?.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {isSendingAlerts && (
                    <span className="flex items-center gap-1 text-primary">
                      <Bell className="h-3 w-3 animate-pulse" />
                      Sending availability alerts to patients...
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search medications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Dialog open={showMedicationDialog} onOpenChange={setShowMedicationDialog}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Medication
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Medication Availability</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Medication *</Label>
                        <Select
                          value={medicationForm.medication_catalog_id}
                          onValueChange={(v) => setMedicationForm({ ...medicationForm, medication_catalog_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select from catalog" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-lg z-50 max-h-60">
                            {catalogItems?.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {formatCatalogLabel(item)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Quantity Available</Label>
                          <Input
                            type="number"
                            value={medicationForm.quantity_available}
                            onChange={(e) => setMedicationForm({ ...medicationForm, quantity_available: e.target.value })}
                            placeholder="e.g., 100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Price (&#x20A6;)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={medicationForm.price_naira}
                            onChange={(e) => setMedicationForm({ ...medicationForm, price_naira: e.target.value })}
                            placeholder="e.g., 500.00"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Notes</Label>
                        <Input
                          value={medicationForm.notes}
                          onChange={(e) => setMedicationForm({ ...medicationForm, notes: e.target.value })}
                          placeholder="e.g., Brand: Emzor"
                        />
                      </div>
                      <Button
                        onClick={() => createMedicationMutation.mutate()}
                        disabled={!medicationForm.medication_catalog_id || createMedicationMutation.isPending}
                        className="w-full"
                      >
                        {createMedicationMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Adding & Notifying Patients...
                          </>
                        ) : (
                          "Add & Notify Subscribed Patients"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingMedications ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !filteredMedications?.length ? (
              <p className="text-muted-foreground text-center py-8">
                {searchQuery ? "No medications match your search" : "No medications added yet"}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medication</TableHead>
                    <TableHead>Dosage</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price (&#x20A6;)</TableHead>
                    <TableHead>Available</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMedications.map((med) => (
                    <TableRow key={med.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{med.medication_catalog?.name ?? "Unknown"}</p>
                          {med.medication_catalog?.generic_name && (
                            <p className="text-sm text-muted-foreground">{med.medication_catalog.generic_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{med.medication_catalog?.dosage || "-"}</TableCell>
                      <TableCell className="capitalize">{med.medication_catalog?.form || "-"}</TableCell>
                      <TableCell>{med.quantity_available ?? "-"}</TableCell>
                      <TableCell>
                        {med.price_naira ? `₦${med.price_naira.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={med.is_available}
                          onCheckedChange={(checked) =>
                            toggleAvailabilityMutation.mutate({ id: med.id, isAvailable: checked })
                          }
                          disabled={toggleAvailabilityMutation.isPending}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
