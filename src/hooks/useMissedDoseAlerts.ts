interface PatientInfo {
  patient_user_id: string;
  patient_name: string;
  medications: Map<string, string>; // medication_id -> name
}

export function useMissedDoseAlerts(
  patientInfoList: PatientInfo[],
  enabled = true
) {
  // Realtime subscription removed; missed dose alerts are handled via polling in parent components
}
