import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PatientCDSData {
  id: string;
  name: string;
  symptoms?: Array<{
    name: string;
    severity: number;
    notes?: string;
  }>;
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
  medications?: Array<{
    name: string;
    dosage: string;
    form: string;
  }>;
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

      // Fetch patient profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", patientId)
        .single();

      // Fetch chronic conditions
      const { data: conditions } = await supabase
        .from("patient_chronic_conditions")
        .select("condition_name")
        .eq("user_id", patientId)
        .eq("is_active", true);

      // Fetch allergies
      const { data: allergies } = await supabase
        .from("patient_allergies")
        .select("allergen")
        .eq("user_id", patientId);

      // Fetch recent symptoms (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: symptoms } = await supabase
        .from("symptom_entries")
        .select("symptom_type, severity, description")
        .eq("user_id", patientId)
        .gte("recorded_at", thirtyDaysAgo.toISOString())
        .order("recorded_at", { ascending: false })
        .limit(20);

      // Fetch latest vitals
      const { data: vitals } = await supabase
        .from("patient_vitals")
        .select("blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, respiratory_rate, oxygen_saturation")
        .eq("user_id", patientId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .single();

      // Fetch recent lab results
      const { data: labResults } = await supabase
        .from("lab_results")
        .select("test_name, result_value, reference_range, is_abnormal")
        .eq("user_id", patientId)
        .order("resulted_at", { ascending: false })
        .limit(20);

      // Fetch active medications
      const { data: medications } = await supabase
        .from("medications")
        .select("name, dosage, form")
        .eq("user_id", patientId)
        .eq("is_active", true);

      return {
        id: patientId,
        name: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() || "Patient",
        symptoms: symptoms?.map((s) => ({
          name: s.symptom_type,
          severity: s.severity,
          notes: s.description || undefined,
        })),
        vitals: vitals || undefined,
        labResults: labResults?.map((l) => ({
          test_name: l.test_name,
          result_value: l.result_value,
          reference_range: l.reference_range || undefined,
          is_abnormal: l.is_abnormal || undefined,
        })),
        medications: medications?.map((m) => ({
          name: m.name,
          dosage: m.dosage,
          form: m.form,
        })),
        healthProfile: {
          conditions: conditions?.map((c) => c.condition_name) || [],
          allergies: allergies?.map((a) => ({ allergen: a.allergen })),
        },
      };
    },
    enabled: !!patientId,
  });
}
