/**
 * Send Medication Reminders - Azure Function (Timer)
 * Migrated from Supabase Edge Function
 * Schedule: Every 5 minutes - 0 */5 * * * *
 */

import { app } from '@azure/functions';
import { query } from '../shared/db.js';
import { createFunctionLogger } from '../shared/logger.js';

app.timer('send-medication-reminders', {
  schedule: '0 */5 * * * *',
  handler: async (myTimer, context) => {
    const log = createFunctionLogger('send-medication-reminders', context);
    log.info('Send medication reminders triggered');

    const now = new Date();
    const startTime = new Date(now.getTime());
    const endTime = new Date(now.getTime() + 30 * 60 * 1000);

    try {
      const res = await query(
        `SELECT ml.id, ml.scheduled_time, ml.user_id,
                m.name as med_name, m.dosage, m.dosage_unit, m.form, m.instructions,
                ms.quantity, ms.with_food
         FROM medication_logs ml
         JOIN medications m ON ml.medication_id = m.id
         JOIN medication_schedules ms ON ml.schedule_id = ms.id
         WHERE ml.status = 'pending'
           AND ml.scheduled_time >= $1
           AND ml.scheduled_time <= $2`,
        [startTime.toISOString(), endTime.toISOString()]
      );

      const dosesByUser = new Map();
      for (const row of res.rows) {
        const list = dosesByUser.get(row.user_id) || [];
        list.push(row);
        dosesByUser.set(row.user_id, list);
      }

      for (const [userId, doses] of dosesByUser) {
        const medNames = [...new Set(doses.map((d) => d.med_name))].join(', ');
        log.info(`Sending reminder to user ${userId}`, { userId, medNames });

        await invokeFunction('send-push-notification', {
          user_ids: [userId],
          payload: {
            title: 'Medication Reminder',
            body: `Time to take: ${medNames}`,
            tag: 'medication-reminder',
            data: { url: '/dashboard/schedule' },
          },
        });

        const profileRes = await query(
          'SELECT email, first_name FROM profiles WHERE user_id = $1',
          [userId]
        );
        const profile = profileRes.rows[0];
        if (profile?.email) {
          await invokeFunction('send-email', {
            to: profile.email,
            subject: `Medication Reminder: ${medNames}`,
            template: 'medication_reminder',
            data: { firstName: profile.first_name, medNames, doseCount: doses.length },
          });
        }
      }

      return { processed: dosesByUser.size };
    } catch (err) {
      log.error('Send medication reminders error', { error: err.message });
      throw err;
    }
  },
});

async function invokeFunction(name, body) {
  const baseUrl = process.env.FUNCTIONS_BASE_URL || 'http://localhost:7071';
  const key = process.env.FUNCTIONS_MASTER_KEY;
  const url = `${baseUrl}/api/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key && { 'x-functions-key': key }),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Function ${name} failed: ${res.status}`);
  }
  return res.json();
}
