/**
 * Medication dose fetching utilities
 * Ported from Supabase Edge Functions (_shared/medications/upcomingDoses.ts)
 *
 * Uses shared PostgreSQL client instead of Supabase client.
 */

import { query } from '../db.js';

/**
 * Fetch upcoming medication doses within a time window
 * @param {Date} startTime
 * @param {Date} endTime
 * @returns {Promise<Array<{ id: string, scheduled_time: string, user_id: string, med_name: string, dosage: string, dosage_unit: string, form: string, instructions: string|null, quantity: number, with_food: boolean }>>}
 */
export async function fetchUpcomingDoses(startTime, endTime) {
  const res = await query(
    `SELECT ml.id, ml.scheduled_time, ml.user_id,
            m.name AS med_name, m.dosage, m.dosage_unit, m.form, m.instructions,
            ms.quantity, ms.with_food
     FROM medication_logs ml
     JOIN medications m ON ml.medication_id = m.id
     JOIN medication_schedules ms ON ml.schedule_id = ms.id
     WHERE ml.status = 'pending'
       AND ml.scheduled_time >= $1
       AND ml.scheduled_time <= $2`,
    [startTime.toISOString(), endTime.toISOString()],
  );
  return res.rows;
}

/**
 * Group doses by user ID
 * @param {Array<{ user_id: string }>} doses
 * @returns {Map<string, Array>}
 */
export function groupDosesByUser(doses) {
  const map = new Map();
  for (const dose of doses) {
    const list = map.get(dose.user_id) || [];
    list.push(dose);
    map.set(dose.user_id, list);
  }
  return map;
}

/**
 * Get medication names from flat dose rows
 * @param {Array<{ med_name: string }>} doses
 * @returns {string}
 */
export function getMedicationNames(doses) {
  return doses.map((d) => d.med_name || 'medication').join(', ');
}
