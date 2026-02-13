import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  listPrescriptions,
  listProfilesByUserIds,
  getPrescription,
  generatePrescriptionNumber,
  createPrescription as apiCreatePrescription,
  updatePrescription as apiUpdatePrescription,
  deletePrescription as apiDeletePrescription,
  insertPrescriptionStatusHistory,
} from "@/integrations/azure/data";

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
  | "draft"
  | "pending"
  | "sent"
  | "received"
  | "processing"
  | "ready"
  | "dispensed"
  | "cancelled"
  | "expired";

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

export interface UpdatePrescriptionData {
  medication_name?: string;
  generic_name?: string | null;
  dosage?: string;
  dosage_unit?: string;
  form?: string;
  quantity?: number;
  refills_authorized?: number;
  sig?: string;
  instructions?: string | null;
  pharmacy_id?: string | null;
  is_controlled_substance?: boolean;
  dea_schedule?: string | null;
  dispense_as_written?: boolean;
  diagnosis_code?: string | null;
  diagnosis_description?: string | null;
}

export function usePrescriptions(options?: {
  patientId?: string;
  pharmacyId?: string;
  pharmacyIds?: string[];
  status?: PrescriptionStatus[];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: prescriptions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["prescriptions", user?.id, options?.patientId, options?.pharmacyId, options?.pharmacyIds, options?.status],
    queryFn: async (): Promise<Prescription[]> => {
      const filters: Parameters<typeof listPrescriptions>[0] = {};
      if (options?.patientId) filters.user_id = options.patientId;
      if (options?.pharmacyId) filters.pharmacy_id = options.pharmacyId;
      if (options?.pharmacyIds?.length) filters.pharmacy_ids = options.pharmacyIds;
      if (options?.status?.length) filters.status = options.status;

      const prescriptionsData = await listPrescriptions(filters);
      if (!prescriptionsData || prescriptionsData.length === 0) return [];

      const patientIds = [...new Set(prescriptionsData.map((p) => p.patient_user_id as string))];
      const clinicianIds = [...new Set(prescriptionsData.map((p) => p.clinician_user_id as string))];
      const allUserIds = [...new Set([...patientIds, ...clinicianIds])];
      const profiles = await listProfilesByUserIds(allUserIds);
      const profilesMap = new Map(profiles.map((p) => [p.user_id as string, p]));

      const prescriptionsWithProfiles = prescriptionsData.map((rx) => {
        const patient = profilesMap.get(rx.patient_user_id as string);
        const clinician = profilesMap.get(rx.clinician_user_id as string);
        return {
          ...rx,
          patient_profile: patient
            ? {
                first_name: (patient.first_name as string) ?? null,
                last_name: (patient.last_name as string) ?? null,
                email: (patient.email as string) ?? null,
                phone: (patient.phone as string) ?? null,
              }
            : undefined,
          clinician_profile: clinician
            ? {
                first_name: (clinician.first_name as string) ?? null,
                last_name: (clinician.last_name as string) ?? null,
                license_number: (clinician.license_number as string) ?? null,
              }
            : undefined,
        };
      }) as Prescription[];

      return prescriptionsWithProfiles.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!user,
  });

  const createPrescription = useMutation({
    mutationFn: async (data: CreatePrescriptionData) => {
      if (!user) throw new Error("Not authenticated");

      const prescriptionNumber = await generatePrescriptionNumber();
      const payload = {
        ...data,
        prescription_number: prescriptionNumber,
        clinician_user_id: user.id,
        status: data.pharmacy_id ? "pending" : "draft",
        refills_remaining: data.refills_authorized ?? 0,
      };
      const prescription = await apiCreatePrescription(payload);
      return prescription as Prescription;
    },
    onSuccess: (prescription) => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      toast.success("Prescription created", {
        description: `Rx #${(prescription as Prescription).prescription_number}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Failed to create prescription", { description: error.message });
    },
  });

  const sendPrescription = useMutation({
    mutationFn: async ({ prescriptionId, pharmacyId }: { prescriptionId: string; pharmacyId: string }) => {
      await apiUpdatePrescription(prescriptionId, {
        pharmacy_id: pharmacyId,
        status: "sent",
        sent_at: new Date().toISOString(),
      });
      await insertPrescriptionStatusHistory({
        prescription_id: prescriptionId,
        previous_status: "pending",
        new_status: "sent",
        changed_by: user?.id,
        notes: "Prescription sent to pharmacy",
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
      notes,
    }: {
      prescriptionId: string;
      status: PrescriptionStatus;
      notes?: string;
    }) => {
      const current = await getPrescription(prescriptionId);
      const updates: Record<string, unknown> = { status };
      if (status === "received") updates.received_at = new Date().toISOString();
      if (status === "dispensed") updates.dispensed_at = new Date().toISOString();

      await apiUpdatePrescription(prescriptionId, updates);
      await insertPrescriptionStatusHistory({
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
      const current = await getPrescription(prescriptionId);
      await apiUpdatePrescription(prescriptionId, { status: "cancelled" });
      await insertPrescriptionStatusHistory({
        prescription_id: prescriptionId,
        previous_status: current?.status,
        new_status: "cancelled",
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

  const updatePrescription = useMutation({
    mutationFn: async ({ prescriptionId, data }: { prescriptionId: string; data: UpdatePrescriptionData }) => {
      await apiUpdatePrescription(prescriptionId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      toast.success("Prescription updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update prescription", { description: error.message });
    },
  });

  const deletePrescription = useMutation({
    mutationFn: async (prescriptionId: string) => {
      await apiDeletePrescription(prescriptionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
      toast.success("Prescription deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete prescription", { description: error.message });
    },
  });

  return {
    prescriptions: prescriptions ?? [],
    isLoading,
    error,
    createPrescription,
    sendPrescription,
    updatePrescriptionStatus,
    cancelPrescription,
    updatePrescription,
    deletePrescription,
  };
}
