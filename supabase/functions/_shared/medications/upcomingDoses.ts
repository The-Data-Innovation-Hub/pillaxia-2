/**
 * Medication dose fetching utilities
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export interface MedicationInfo {
  name: string;
  dosage: string;
  dosage_unit: string;
  form: string;
  instructions: string | null;
}

export interface ScheduleInfo {
  quantity: number;
  with_food: boolean;
}

export interface MedicationDose {
  id: string;
  scheduled_time: string;
  user_id: string;
  medications: MedicationInfo | MedicationInfo[] | null;
  medication_schedules: ScheduleInfo | ScheduleInfo[] | null;
}

/**
 * Fetch upcoming medication doses within a time window
 * @param supabase - Supabase client
 * @param startTime - Start of the time window
 * @param endTime - End of the time window
 * @returns Array of upcoming doses
 */
export async function fetchUpcomingDoses(
  supabase: AnySupabaseClient,
  startTime: Date,
  endTime: Date
): Promise<MedicationDose[]> {
  const { data, error } = await supabase
    .from("medication_logs")
    .select(`
      id,
      scheduled_time,
      user_id,
      medications (name, dosage, dosage_unit, form, instructions),
      medication_schedules (quantity, with_food)
    `)
    .eq("status", "pending")
    .gte("scheduled_time", startTime.toISOString())
    .lte("scheduled_time", endTime.toISOString());

  if (error) {
    console.error("Error fetching doses:", error);
    throw error;
  }

  return (data as MedicationDose[]) || [];
}

/**
 * Group doses by user ID
 * @param doses - Array of medication doses
 * @returns Map of user ID to their doses
 */
export function groupDosesByUser(doses: MedicationDose[]): Map<string, MedicationDose[]> {
  const dosesByUser = new Map<string, MedicationDose[]>();

  for (const dose of doses) {
    const existing = dosesByUser.get(dose.user_id) || [];
    existing.push(dose);
    dosesByUser.set(dose.user_id, existing);
  }

  return dosesByUser;
}

/**
 * Extract medication info from dose (handles array/object format)
 */
export function getMedicationFromDose(dose: MedicationDose): MedicationInfo | null {
  const medsData = dose.medications;
  return Array.isArray(medsData) ? (medsData[0] || null) : medsData;
}

/**
 * Extract schedule info from dose (handles array/object format)
 */
export function getScheduleFromDose(dose: MedicationDose): ScheduleInfo | null {
  const schedulesData = dose.medication_schedules;
  return Array.isArray(schedulesData) ? (schedulesData[0] || null) : schedulesData;
}

/**
 * Get medication names from doses
 */
export function getMedicationNames(doses: MedicationDose[]): string {
  return doses
    .map((dose) => getMedicationFromDose(dose)?.name || "medication")
    .join(", ");
}
