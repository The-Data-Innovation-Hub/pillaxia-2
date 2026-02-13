import { useQuery } from "@tanstack/react-query";
import {
  getProfileByUserId,
  listPatientHealthTable,
  listSymptomEntries,
  listMedications,
  listLabResults,
} from "@/integrations/azure/data";
import { subDays } from "date-fns";

interface PatientCDSData {
  id: string;
  name: string;
  symptoms?: Array<{ name: string; severity: number; notes?: string }>;
  vitals?: {
    blood_pressure_systolic?: number;
    blood_pressure_diastolic?: number;
    heart_rate?: number;
    temperature?: number;
    respiratory_rate?: number;
    oxygen_saturation?: number;
  };
  labResults?: Array<{
    test_name: string;
    result_value: string;
    reference_range?: string;
    is_abnormal?: boolean;
  }>;
  medications?: Array<{ name: string; dosage: string; form: string }>;
  healthProfile?: {
    conditions?: string[];
    allergies?: Array<{ allergen: string }>;
  };
}

export function usePatientCDSData(patientId: string | null) {
  return useQuery({
    queryKey: ["patient-cds-data", patientId],
    queryFn: async (): Promise<PatientCDSData | null> => {
      if (!patientId) return null;

      const [profile, conditions, allergies, symptoms, vitalsRows, labResults, medications] =
        await Promise.all([
          getProfileByUserId(patientId),
          listPatientHealthTable("patient_chronic_conditions", patientId),
          listPatientHealthTable("patient_allergies", patientId),
          listSymptomEntries(patientId),
          listPatientHealthTable("patient_vitals", patientId),
          listLabResults(patientId),
          listMedications(patientId),
        ]);

      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
      const recentSymptoms = (symptoms || [])
        .filter((s) => (s.recorded_at as string) >= thirtyDaysAgo)
        .sort(
          (a, b) =>
            new Date((b.recorded_at as string) || 0).getTime() -
            new Date((a.recorded_at as string) || 0).getTime()
        )
        .slice(0, 20);

      const latestVitals = (vitalsRows || []).sort(
        (a, b) =>
          new Date((b.recorded_at as string) || 0).getTime() -
          new Date((a.recorded_at as string) || 0).getTime()
      )[0];

      const activeConditions = (conditions || []).filter((c) => c.is_active !== false);
      const activeMeds = (medications || []).filter((m) => m.is_active !== false);

      const firstName = (profile as Record<string, unknown>)?.first_name as string | undefined;
      const lastName = (profile as Record<string, unknown>)?.last_name as string | undefined;
      const name = `${firstName || ""} ${lastName || ""}`.trim() || "Patient";

      return {
        id: patientId,
        name,
        symptoms: recentSymptoms.map((s) => ({
          name: (s.symptom_type as string) || "",
          severity: (s.severity as number) ?? 0,
          notes: (s.description as string) || undefined,
        })),
        vitals: latestVitals
          ? {
              blood_pressure_systolic: latestVitals.blood_pressure_systolic as number | undefined,
              blood_pressure_diastolic: latestVitals.blood_pressure_diastolic as number | undefined,
              heart_rate: latestVitals.heart_rate as number | undefined,
              temperature: latestVitals.temperature as number | undefined,
              respiratory_rate: latestVitals.respiratory_rate as number | undefined,
              oxygen_saturation: latestVitals.oxygen_saturation as number | undefined,
            }
          : undefined,
        labResults: (labResults || [])
          .slice(0, 20)
          .map((l) => ({
            test_name: (l.test_name as string) || "",
            result_value: (l.result_value as string) || "",
            reference_range: (l.reference_range as string) || undefined,
            is_abnormal: l.is_abnormal as boolean | undefined,
          })),
        medications: activeMeds.map((m) => ({
          name: (m.name as string) || "",
          dosage: (m.dosage as string) || "",
          form: (m.form as string) || "",
        })),
        healthProfile: {
          conditions: activeConditions.map((c) => (c.condition_name as string) || ""),
          allergies: (allergies || []).map((a) => ({ allergen: (a.allergen as string) || "" })),
        },
      };
    },
    enabled: !!patientId,
  });
}
