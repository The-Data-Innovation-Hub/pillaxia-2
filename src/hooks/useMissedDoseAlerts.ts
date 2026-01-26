import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface MedicationLog {
  id: string;
  user_id: string;
  medication_id: string;
  status: string;
  scheduled_time: string;
}

interface PatientInfo {
  patient_user_id: string;
  patient_name: string;
  medications: Map<string, string>; // medication_id -> name
}

export function useMissedDoseAlerts(
  patientInfoList: PatientInfo[],
  enabled: boolean = true
) {
  const { toast } = useToast();
  const patientMapRef = useRef<Map<string, PatientInfo>>(new Map());

  // Update the patient map when the list changes
  useEffect(() => {
    const map = new Map<string, PatientInfo>();
    patientInfoList.forEach((patient) => {
      map.set(patient.patient_user_id, patient);
    });
    patientMapRef.current = map;
  }, [patientInfoList]);

  useEffect(() => {
    if (!enabled || patientInfoList.length === 0) return;

    const patientIds = patientInfoList.map((p) => p.patient_user_id);

    const channel = supabase
      .channel("missed-dose-alerts")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "medication_logs",
        },
        (payload: RealtimePostgresChangesPayload<MedicationLog>) => {
          const newRecord = payload.new as MedicationLog;
          const oldRecord = payload.old as Partial<MedicationLog>;

          // Check if this is a status change to "missed"
          if (
            newRecord.status === "missed" &&
            oldRecord.status !== "missed" &&
            patientIds.includes(newRecord.user_id)
          ) {
            const patient = patientMapRef.current.get(newRecord.user_id);
            if (patient) {
              const medicationName =
                patient.medications.get(newRecord.medication_id) ||
                "a medication";

              toast({
                variant: "destructive",
                title: "⚠️ Missed Dose Alert",
                description: `${patient.patient_name} missed ${medicationName}`,
                duration: 10000,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, patientInfoList, toast]);
}
