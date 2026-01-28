import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface Prescription {
  id: string;
  prescription_number: string;
  patient_user_id: string;
  clinician_user_id: string;
  pharmacy_id: string | null;
  medication_name: string;
  generic_name: string | null;
  dosage: string;
  dosage_unit: string;
  form: string;
  quantity: number;
  refills_authorized: number;
  refills_remaining: number;
  sig: string;
  instructions: string | null;
  date_written: string;
  date_expires: string | null;
  status: PrescriptionStatus;
  is_controlled_substance: boolean;
  dea_schedule: string | null;
  dispense_as_written: boolean;
  diagnosis_code: string | null;
  diagnosis_description: string | null;
  sent_at: string | null;
  received_at: string | null;
  dispensed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  patient_profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  };
  clinician_profile?: {
    first_name: string | null;
    last_name: string | null;
    license_number: string | null;
  };
  pharmacy?: {
    name: string;
    phone: string | null;
    email: string | null;
  };
}

export type PrescriptionStatus = 
  | 'draft' 
  | 'pending' 
  | 'sent' 
  | 'received' 
  | 'processing' 
  | 'ready' 
  | 'dispensed' 
  | 'cancelled' 
  | 'expired';

export interface CreatePrescriptionData {
  patient_user_id: string;
  pharmacy_id?: string;
  medication_name: string;
  generic_name?: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  quantity: number;
  refills_authorized?: number;
  sig: string;
  instructions?: string;
  date_expires?: string;
  is_controlled_substance?: boolean;
  dea_schedule?: string;
  dispense_as_written?: boolean;
  diagnosis_code?: string;
  diagnosis_description?: string;
}

async function generatePrescriptionNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_prescription_number');
  if (error) throw error;
  return data as string;
}

export function usePrescriptions(options?: { 
  patientId?: string; 
  pharmacyId?: string;
  status?: PrescriptionStatus[];
}) {
  const { user, isClinician, isPharmacist, isPatient } = useAuth();
  const queryClient = useQueryClient();

  const { data: prescriptions, isLoading, error } = useQuery({
    queryKey: ["prescriptions", user?.id, options?.patientId, options?.pharmacyId, options?.status],
    queryFn: async (): Promise<Prescription[]> => {
      // First, fetch prescriptions with pharmacy data
      let query = supabase
        .from("prescriptions")
        .select(`
          *,
          pharmacy:pharmacy_locations(name, phone, email)
        `)
        .order("created_at", { ascending: false });

      if (options?.patientId) {
        query = query.eq("patient_user_id", options.patientId);
      }

      if (options?.pharmacyId) {
        query = query.eq("pharmacy_id", options.pharmacyId);
      }

      if (options?.status && options.status.length > 0) {
        query = query.in("status", options.status);
      }

      const { data: prescriptionsData, error: prescriptionsError } = await query;
      if (prescriptionsError) throw prescriptionsError;

      if (!prescriptionsData || prescriptionsData.length === 0) {
        return [];
      }

      // Get unique user IDs for patients and clinicians
      const patientIds = [...new Set(prescriptionsData.map(p => p.patient_user_id))];
      const clinicianIds = [...new Set(prescriptionsData.map(p => p.clinician_user_id))];
      const allUserIds = [...new Set([...patientIds, ...clinicianIds])];

      // Fetch profiles for all users in one query
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email, phone, license_number")
        .in("user_id", allUserIds);

      // Create a map for quick lookup
      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      // Merge profiles into prescriptions
      const prescriptionsWithProfiles = prescriptionsData.map(rx => ({
        ...rx,
        patient_profile: profilesMap.get(rx.patient_user_id) ? {
          first_name: profilesMap.get(rx.patient_user_id)?.first_name || null,
          last_name: profilesMap.get(rx.patient_user_id)?.last_name || null,
          email: profilesMap.get(rx.patient_user_id)?.email || null,
          phone: profilesMap.get(rx.patient_user_id)?.phone || null,
        } : undefined,
        clinician_profile: profilesMap.get(rx.clinician_user_id) ? {
          first_name: profilesMap.get(rx.clinician_user_id)?.first_name || null,
          last_name: profilesMap.get(rx.clinician_user_id)?.last_name || null,
          license_number: profilesMap.get(rx.clinician_user_id)?.license_number || null,
        } : undefined,
      }));

      return prescriptionsWithProfiles as Prescription[];
    },
    enabled: !!user,
  });

  const createPrescription = useMutation({
    mutationFn: async (data: CreatePrescriptionData) => {
      if (!user) throw new Error("Not authenticated");

      const prescriptionNumber = await generatePrescriptionNumber();

      const { data: prescription, error } = await supabase
        .from("prescriptions")
        .insert({
          ...data,
          prescription_number: prescriptionNumber,
          clinician_user_id: user.id,
          status: data.pharmacy_id ? 'pending' : 'draft',
          refills_remaining: data.refills_authorized || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return prescription;
    },
    onSuccess: (prescription) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      toast.success("Prescription created", {
        description: `Rx #${prescription.prescription_number}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to create prescription", { description: error.message });
    },
  });

  const sendPrescription = useMutation({
    mutationFn: async ({ prescriptionId, pharmacyId }: { prescriptionId: string; pharmacyId: string }) => {
      const { error } = await supabase
        .from("prescriptions")
        .update({ 
          pharmacy_id: pharmacyId, 
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq("id", prescriptionId);

      if (error) throw error;

      // Log status change
      await supabase.from("prescription_status_history").insert({
        prescription_id: prescriptionId,
        previous_status: 'pending',
        new_status: 'sent',
        changed_by: user?.id,
        notes: 'Prescription sent to pharmacy',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      toast.success("Prescription sent to pharmacy");
    },
    onError: (error: Error) => {
      toast.error("Failed to send prescription", { description: error.message });
    },
  });

  const updatePrescriptionStatus = useMutation({
    mutationFn: async ({ 
      prescriptionId, 
      status, 
      notes 
    }: { 
      prescriptionId: string; 
      status: PrescriptionStatus; 
      notes?: string;
    }) => {
      // Get current status
      const { data: current } = await supabase
        .from("prescriptions")
        .select("status")
        .eq("id", prescriptionId)
        .single();

      const updates: Record<string, any> = { status };
      if (status === 'received') updates.received_at = new Date().toISOString();
      if (status === 'dispensed') updates.dispensed_at = new Date().toISOString();

      const { error } = await supabase
        .from("prescriptions")
        .update(updates)
        .eq("id", prescriptionId);

      if (error) throw error;

      // Log status change
      await supabase.from("prescription_status_history").insert({
        prescription_id: prescriptionId,
        previous_status: current?.status,
        new_status: status,
        changed_by: user?.id,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      toast.success("Prescription status updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update status", { description: error.message });
    },
  });

  const cancelPrescription = useMutation({
    mutationFn: async ({ prescriptionId, reason }: { prescriptionId: string; reason: string }) => {
      const { data: current } = await supabase
        .from("prescriptions")
        .select("status")
        .eq("id", prescriptionId)
        .single();

      const { error } = await supabase
        .from("prescriptions")
        .update({ status: 'cancelled' })
        .eq("id", prescriptionId);

      if (error) throw error;

      await supabase.from("prescription_status_history").insert({
        prescription_id: prescriptionId,
        previous_status: current?.status,
        new_status: 'cancelled',
        changed_by: user?.id,
        notes: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      toast.success("Prescription cancelled");
    },
    onError: (error: Error) => {
      toast.error("Failed to cancel prescription", { description: error.message });
    },
  });

  return {
    prescriptions,
    isLoading,
    error,
    createPrescription,
    sendPrescription,
    updatePrescriptionStatus,
    cancelPrescription,
  };
}
