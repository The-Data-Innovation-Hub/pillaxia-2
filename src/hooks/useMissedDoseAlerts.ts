import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { listMedicationLogs } from "@/integrations/azure/data";
import { subMinutes } from "date-fns";

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
  medications: Map<string, string>;
}

export function useMissedDoseAlerts(
  patientInfoList: PatientInfo[],
  enabled = true
) {
  const { toast } = useToast();
  const patientMapRef = useRef<Map<string, PatientInfo>>(new Map());
  const notifiedMissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const map = new Map<string, PatientInfo>();
    patientInfoList.forEach((patient) => {
      map.set(patient.patient_user_id, patient);
    });
    patientMapRef.current = map;
  }, [patientInfoList]);

  const patientIds = patientInfoList.map((p) => p.patient_user_id);

  const { data: missedLogs } = useQuery({
    queryKey: ["missed-dose-alerts", patientIds],
    queryFn: async () => {
      const from = subMinutes(new Date(), 60).toISOString();
      const to = new Date().toISOString();
      const allLogs: MedicationLog[] = [];
      for (const patientId of patientIds) {
        const logs = await listMedicationLogs(patientId, { from, to });
        allLogs.push(
          ...(logs as MedicationLog[]).filter((l) => l.user_id === patientId)
        );
      }
      return allLogs.filter((l) => l.status === "missed");
    },
    enabled: enabled && patientIds.length > 0,
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!missedLogs?.length) return;
    const patientMap = patientMapRef.current;
    for (const log of missedLogs) {
      const key = `${log.id}-${log.status}`;
      if (notifiedMissedRef.current.has(key)) continue;
      notifiedMissedRef.current.add(key);
      const patient = patientMap.get(log.user_id);
      if (patient) {
        const medicationName =
          patient.medications.get(log.medication_id) || "a medication";
        toast({
          variant: "destructive",
          title: "⚠️ Missed Dose Alert",
          description: `${patient.patient_name} missed ${medicationName}`,
          duration: 10000,
        });
      }
    }
  }, [missedLogs, toast]);
}
