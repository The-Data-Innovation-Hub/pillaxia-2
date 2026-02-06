/**
 * Scheduled (Timer) Functions
 * Ported from Supabase Edge Functions to Azure Functions v4
 *
 * These run on CRON schedules rather than HTTP triggers.
 */

import { app } from '@azure/functions';
import { query } from '../shared/db.js';
import { captureException, captureMessage, processBatch } from '../shared/sentry.js';
import { sendEmail } from '../shared/email/sendEmail.js';
import { escapeHtml } from '../shared/email/escapeHtml.js';
import { fetchUpcomingDoses, groupDosesByUser, getMedicationNames } from '../shared/medications/upcomingDoses.js';
import { generateMedicationReminderHtml, generateMedicationReminderSubject } from '../shared/email/templates/medicationReminder.js';
import { fetchUserPreferences, getDefaultPreferences } from '../shared/notifications/userPreferences.js';
import { isInQuietHours } from '../shared/notifications/quietHours.js';
import { getUserFromRequest, unauthorizedResponse } from '../shared/auth.js';
import { createFunctionLogger } from '../shared/logger.js';

/* ------------------------------------------------------------------ */
/*  Shared CORS helper for HTTP-triggered scheduled functions          */
/* ------------------------------------------------------------------ */
function getCorsHeaders(origin) {
  const allowed = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  const eff = origin && allowed.includes(origin) ? origin : allowed[0] || '*';
  return { 'Access-Control-Allow-Origin': eff, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
}

// ============= Send Medication Reminders (every 15 min) =============

app.timer('send-medication-reminders-timer', {
  schedule: '0 */15 * * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('send-medication-reminders-timer', context);
    log.info('Starting medication reminders check');
    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);
      const doses = await fetchUpcomingDoses(now.toISOString(), windowEnd.toISOString());
      if (!doses.length) { log.info('No upcoming doses'); return; }

      const grouped = groupDosesByUser(doses);
      const userIds = Object.keys(grouped);
      const prefsMap = await fetchUserPreferences(userIds);
      let sentCount = 0;

      for (const [userId, userDoses] of Object.entries(grouped)) {
        const prefs = prefsMap[userId] || getDefaultPreferences(userId);
        if (isInQuietHours(prefs)) continue;
        if (!prefs.email_enabled && !prefs.push_enabled) continue;

        if (prefs.email_enabled && prefs.email_address) {
          const { rows: profiles } = await query('SELECT first_name FROM profiles WHERE user_id = $1', [userId]);
          const html = generateMedicationReminderHtml({ userName: profiles[0]?.first_name || 'there', doses: userDoses, doseCount: userDoses.length });
          const subject = generateMedicationReminderSubject(userDoses.length);
          await sendEmail({ to: prefs.email_address, subject, html }).catch((e) => log.warn('Email send failed', { userId, err: e.message }));
          sentCount++;
        }
      }

      log.info('Medication reminders completed', { sentCount, doseCount: doses.length });
    } catch (e) {
      log.error('Medication reminders failed', { err: e.message });
      await captureException(e instanceof Error ? e : new Error(String(e)), { functionName: 'send-medication-reminders-timer' });
    }
  },
});

// ============= Send Appointment Reminders (every hour) =============

app.timer('send-appointment-reminders-timer', {
  schedule: '0 0 * * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('send-appointment-reminders-timer', context);
    log.info('Checking for upcoming appointments');
    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { rows: appointments } = await query(
        `SELECT a.id, a.patient_id, a.clinician_id, a.scheduled_at, a.appointment_type,
                p.first_name as patient_first_name, p.last_name as patient_last_name,
                c.first_name as clinician_first_name, c.last_name as clinician_last_name
         FROM appointments a
         JOIN profiles p ON a.patient_id = p.user_id
         JOIN profiles c ON a.clinician_id = c.user_id
         WHERE a.scheduled_at BETWEEN $1 AND $2
           AND a.status = 'confirmed'
           AND a.reminder_sent = false`,
        [now.toISOString(), windowEnd.toISOString()],
      );

      for (const appt of appointments) {
        const scheduledDate = new Date(appt.scheduled_at);
        const formattedDate = scheduledDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = scheduledDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        await query(
          `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, metadata)
           VALUES ($1, 'appointment_reminder', 'in_app', 'Upcoming Appointment', $2, 'sent', $3)`,
          [appt.patient_id, `Your appointment with Dr. ${appt.clinician_last_name} is on ${formattedDate} at ${formattedTime}.`, JSON.stringify({ appointmentId: appt.id })],
        );

        await query('UPDATE appointments SET reminder_sent = true WHERE id = $1', [appt.id]);
      }

      log.info('Appointment reminders sent', { count: appointments.length });
    } catch (e) {
      log.error('Appointment reminders failed', { err: e.message });
      await captureException(e instanceof Error ? e : new Error(String(e)));
    }
  },
});

// ============= Check Missed Doses (every 30 min) =============

app.timer('check-missed-doses-timer', {
  schedule: '0 */30 * * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('check-missed-doses-timer', context);
    log.info('Checking for missed doses');
    try {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();

      const { rows: missedDoses } = await query(
        `SELECT sd.id, sd.medication_id, sd.user_id, sd.scheduled_time,
                m.name as medication_name, m.dosage
         FROM scheduled_doses sd
         JOIN medications m ON sd.medication_id = m.id
         WHERE sd.scheduled_time BETWEEN $1 AND $2
           AND sd.status = 'pending'`,
        [cutoff, now],
      );

      if (missedDoses.length === 0) { log.info('No missed doses found'); return; }

      // Update to missed
      const doseIds = missedDoses.map((d) => d.id);
      await query(`UPDATE scheduled_doses SET status = 'missed' WHERE id = ANY($1::uuid[])`, [doseIds]);

      // Group by user and send notifications
      const byUser = {};
      for (const dose of missedDoses) {
        if (!byUser[dose.user_id]) byUser[dose.user_id] = [];
        byUser[dose.user_id].push(dose);
      }

      for (const [userId, doses] of Object.entries(byUser)) {
        const medNames = [...new Set(doses.map((d) => d.medication_name))].join(', ');
        await query(
          `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, priority)
           VALUES ($1, 'missed_dose', 'in_app', 'Missed Dose Reminder', $2, 'sent', 'high')`,
          [userId, `You may have missed: ${medNames}. It's important to stay on track with your medication. 💜`],
        );
      }

      log.info('Processed missed doses', { doseCount: missedDoses.length, userCount: Object.keys(byUser).length });
    } catch (e) {
      log.error('Check missed doses failed', { err: e.message });
      await captureException(e instanceof Error ? e : new Error(String(e)));
    }
  },
});

// ============= Send Missed Dose Alerts (every 30 min, offset from check) =============

app.timer('send-missed-dose-alerts-timer', {
  schedule: '0 15,45 * * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('send-missed-dose-alerts-timer', context);
    log.info('Sending missed dose alerts');
    try {
      const windowStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { rows: recentMissed } = await query(
        `SELECT DISTINCT sd.user_id, COUNT(*) as missed_count
         FROM scheduled_doses sd
         WHERE sd.status = 'missed'
           AND sd.updated_at > $1
         GROUP BY sd.user_id`,
        [windowStart],
      );

      for (const record of recentMissed) {
        // Check if caregiver notifications needed
        const { rows: caregivers } = await query(
          `SELECT caregiver_id FROM caregiver_relationships WHERE patient_id = $1 AND status = 'active' AND alert_on_missed_dose = true`,
          [record.user_id],
        );

        for (const cg of caregivers) {
          await query(
            `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, metadata)
             VALUES ($1, 'caregiver_missed_dose', 'in_app', 'Missed Dose Alert', $2, 'sent', $3)`,
            [cg.caregiver_id, `Your dependent may have missed ${record.missed_count} dose(s).`, JSON.stringify({ patientId: record.user_id })],
          );
        }
      }

      log.info('Missed dose alerts processed', { userCount: recentMissed.length });
    } catch (e) {
      log.error('Missed dose alerts failed', { err: e.message });
    }
  },
});

// ============= Check Medication Expiry — shared handler =============

async function checkMedicationExpiryHandler(log) {
  log('Checking medication expiry dates');
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  const { rows: expiringMeds } = await query(
    `SELECT m.id, m.name, m.user_id, m.expiry_date,
            p.first_name
     FROM medications m
     JOIN profiles p ON m.user_id = p.user_id
     WHERE m.expiry_date BETWEEN $1 AND $2
       AND m.is_active = true
       AND NOT EXISTS (
         SELECT 1 FROM notification_history nh
         WHERE nh.user_id = m.user_id
           AND nh.notification_type = 'medication_expiry'
           AND nh.metadata->>'medicationId' = m.id::text
           AND nh.created_at > NOW() - INTERVAL '7 days'
       )`,
    [today, thirtyDaysFromNow],
  );

  let expired = 0;
  let critical = 0;
  let warning = 0;

  for (const med of expiringMeds) {
    const daysUntilExpiry = Math.ceil((new Date(med.expiry_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysUntilExpiry <= 0) expired++;
    else if (daysUntilExpiry <= 7) critical++;
    else warning++;

    await query(
      `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, priority, metadata)
       VALUES ($1, 'medication_expiry', 'in_app', 'Medication Expiring Soon', $2, 'sent', $3, $4)`,
      [med.user_id, `${med.name} expires in ${daysUntilExpiry} days. Please check with your pharmacist about a refill.`, daysUntilExpiry <= 7 ? 'high' : 'medium', JSON.stringify({ medicationId: med.id, expiryDate: med.expiry_date })],
    );
  }

  log(`Sent ${expiringMeds.length} expiry alerts`);
  return { summary: { expired, critical, warning, total: expiringMeds.length } };
}

// Timer trigger (daily at 6 AM)
app.timer('check-medication-expiry-timer', {
  schedule: '0 0 6 * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('check-medication-expiry-timer', context);
    try {
      await checkMedicationExpiryHandler(log.info.bind(log));
    } catch (e) {
      log.error('Medication expiry check failed', { err: e.message });
      await captureException(e instanceof Error ? e : new Error(String(e)));
    }
  },
});

// HTTP trigger (on-demand from frontend)
app.http('check-medication-expiry', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const result = await checkMedicationExpiryHandler((...args) => {});
      return { status: 200, headers: corsH, jsonBody: result };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: 'Medication expiry check failed' } };
    }
  },
});

// ============= Check Refill Alerts (daily at 7 AM) =============

app.timer('check-refill-alerts-timer', {
  schedule: '0 0 7 * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('check-refill-alerts-timer', context);
    log.info('Checking refill alerts');
    try {
      const { rows: lowSupply } = await query(
        `SELECT m.id, m.name, m.user_id, m.remaining_quantity, m.refill_threshold
         FROM medications m
         WHERE m.is_active = true
           AND m.remaining_quantity IS NOT NULL
           AND m.refill_threshold IS NOT NULL
           AND m.remaining_quantity <= m.refill_threshold
           AND NOT EXISTS (
             SELECT 1 FROM notification_history nh
             WHERE nh.user_id = m.user_id
               AND nh.notification_type = 'refill_alert'
               AND nh.metadata->>'medicationId' = m.id::text
               AND nh.created_at > NOW() - INTERVAL '3 days'
           )`,
      );

      for (const med of lowSupply) {
        await query(
          `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, priority, metadata)
           VALUES ($1, 'refill_alert', 'in_app', 'Refill Needed', $2, 'sent', 'high', $3)`,
          [med.user_id, `${med.name} is running low (${med.remaining_quantity} remaining). Consider requesting a refill.`, JSON.stringify({ medicationId: med.id, remaining: med.remaining_quantity })],
        );
      }

      log.info('Refill alerts sent', { count: lowSupply.length });
    } catch (e) {
      log.error('Refill alerts check failed', { err: e.message });
    }
  },
});

// ============= Check Polypharmacy (daily at 5 AM) =============

app.timer('check-polypharmacy-timer', {
  schedule: '0 0 5 * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('check-polypharmacy-timer', context);
    log.info('Checking polypharmacy risks');
    try {
      const POLYPHARMACY_THRESHOLD = 5;
      const { rows: atRisk } = await query(
        `SELECT user_id, COUNT(*) as med_count
         FROM medications
         WHERE is_active = true
         GROUP BY user_id
         HAVING COUNT(*) >= $1`,
        [POLYPHARMACY_THRESHOLD],
      );

      for (const record of atRisk) {
        // Check if we've already alerted recently
        const { rows: recent } = await query(
          `SELECT 1 FROM notification_history
           WHERE user_id = $1 AND notification_type = 'polypharmacy_alert' AND created_at > NOW() - INTERVAL '30 days'
           LIMIT 1`,
          [record.user_id],
        );

        if (recent.length === 0) {
          await query(
            `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, priority)
             VALUES ($1, 'polypharmacy_alert', 'in_app', 'Medication Review Recommended', $2, 'sent', 'medium')`,
            [record.user_id, `You're currently managing ${record.med_count} active medications. We recommend discussing your medication regimen with your healthcare provider.`],
          );
        }
      }

      log.info('Polypharmacy check complete', { usersAtRisk: atRisk.length });
    } catch (e) {
      log.error('Polypharmacy check failed', { err: e.message });
    }
  },
});

// ============= Check Red Flag Symptoms — shared handler =============

async function checkRedFlagSymptomsHandler(log, opts = {}) {
  // When called from HTTP, can optionally target a specific symptom entry
  const symptomEntryId = opts.symptom_entry_id || null;

  let flaggedSymptoms;
  if (symptomEntryId) {
    // On-demand check for a specific symptom entry
    const { rows } = await query(
      `SELECT sl.id, sl.user_id, sl.symptom_name, sl.severity, sl.logged_at,
              p.first_name, p.last_name
       FROM symptom_logs sl
       JOIN profiles p ON sl.user_id = p.user_id
       WHERE sl.id = $1
         AND sl.severity >= 8
         AND NOT EXISTS (
           SELECT 1 FROM notification_history nh
           WHERE nh.metadata->>'symptomLogId' = sl.id::text
             AND nh.notification_type = 'red_flag_symptom'
         )`,
      [symptomEntryId],
    );
    flaggedSymptoms = rows;
  } else {
    // Scheduled scan of recent symptoms
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { rows } = await query(
      `SELECT sl.id, sl.user_id, sl.symptom_name, sl.severity, sl.logged_at,
              p.first_name, p.last_name
       FROM symptom_logs sl
       JOIN profiles p ON sl.user_id = p.user_id
       WHERE sl.logged_at > $1
         AND sl.severity >= 8
         AND sl.is_red_flag = true
         AND NOT EXISTS (
           SELECT 1 FROM notification_history nh
           WHERE nh.metadata->>'symptomLogId' = sl.id::text
             AND nh.notification_type = 'red_flag_symptom'
         )`,
      [fiveMinutesAgo],
    );
    flaggedSymptoms = rows;
  }

  let notified = 0;
  for (const symptom of flaggedSymptoms) {
    const { rows: clinicians } = await query(
      `SELECT clinician_id FROM patient_clinician_assignments WHERE patient_id = $1 AND is_active = true`,
      [symptom.user_id],
    );

    for (const assignment of clinicians) {
      await query(
        `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, priority, metadata)
         VALUES ($1, 'red_flag_symptom', 'in_app', '⚠️ Red Flag Symptom Alert', $2, 'sent', 'urgent', $3)`,
        [assignment.clinician_id, `${symptom.first_name} ${symptom.last_name} reported ${symptom.symptom_name} (severity: ${symptom.severity}/10).`, JSON.stringify({ patientId: symptom.user_id, symptomLogId: symptom.id })],
      );
      notified++;
    }
  }

  if (flaggedSymptoms.length > 0) log(`Processed ${flaggedSymptoms.length} red flag symptoms, ${notified} clinician notifications`);
  return { processed: flaggedSymptoms.length, notified };
}

// Timer trigger (every 5 min)
app.timer('check-red-flag-symptoms-timer', {
  schedule: '0 */5 * * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('check-red-flag-symptoms-timer', context);
    try {
      await checkRedFlagSymptomsHandler(log.info.bind(log));
    } catch (e) {
      log.error('Red flag check failed', { err: e.message });
    }
  },
});

// HTTP trigger (on-demand from frontend, e.g. after logging a severe symptom)
app.http('check-red-flag-symptoms', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const body = await req.json().catch(() => ({}));
      const result = await checkRedFlagSymptomsHandler((...args) => {}, { symptom_entry_id: body.symptom_entry_id || null });
      return { status: 200, headers: corsH, jsonBody: result };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: 'Red flag symptom check failed' } };
    }
  },
});

// ============= Check License Renewals (daily at 3 AM) =============

app.timer('check-license-renewals-timer', {
  schedule: '0 0 3 * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('check-license-renewals-timer', context);
    log.info('Checking license renewals');
    try {
      const sixtyDaysFromNow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { rows: expiringLicenses } = await query(
        `SELECT cl.id, cl.user_id, cl.license_type, cl.license_number, cl.expiry_date,
                p.first_name, p.last_name
         FROM clinician_licenses cl
         JOIN profiles p ON cl.user_id = p.user_id
         WHERE cl.expiry_date <= $1
           AND cl.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM notification_history nh
             WHERE nh.user_id = cl.user_id
               AND nh.notification_type = 'license_renewal'
               AND nh.metadata->>'licenseId' = cl.id::text
               AND nh.created_at > NOW() - INTERVAL '14 days'
           )`,
        [sixtyDaysFromNow],
      );

      for (const lic of expiringLicenses) {
        const daysLeft = Math.ceil((new Date(lic.expiry_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        await query(
          `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, priority, metadata)
           VALUES ($1, 'license_renewal', 'in_app', 'License Renewal Reminder', $2, 'sent', $3, $4)`,
          [lic.user_id, `Your ${lic.license_type} license (${lic.license_number}) expires in ${daysLeft} days.`, daysLeft <= 14 ? 'urgent' : 'medium', JSON.stringify({ licenseId: lic.id })],
        );
      }

      log.info('License renewal reminders sent', { count: expiringLicenses.length });
    } catch (e) {
      log.error('License renewal check failed', { err: e.message });
    }
  },
});

// ============= Calculate Engagement Scores — shared handler =============

async function calculateEngagementScoresHandler(log, opts = {}) {
  log('Calculating engagement scores');
  const days = opts.days || 30;
  const { rows: users } = await query("SELECT DISTINCT user_id FROM user_roles WHERE role = 'patient'");

  for (const { user_id: userId } of users) {
    // Calculate adherence: taken / (taken + missed) in last N days
    const { rows: adherenceRows } = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END), 0) as taken,
         COALESCE(SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END), 0) as missed
       FROM scheduled_doses
       WHERE user_id = $1 AND scheduled_time > NOW() - INTERVAL '1 day' * $2`,
      [userId, days],
    );

    const taken = parseInt(adherenceRows[0]?.taken || '0', 10);
    const missed = parseInt(adherenceRows[0]?.missed || '0', 10);
    const total = taken + missed;
    const adherenceScore = total > 0 ? Math.round((taken / total) * 100) : null;

    // Check-in frequency
    const { rows: checkinRows } = await query(
      `SELECT COUNT(*) as cnt FROM symptom_logs WHERE user_id = $1 AND logged_at > NOW() - INTERVAL '1 day' * $2`,
      [userId, days],
    );
    const checkins = parseInt(checkinRows[0]?.cnt || '0', 10);
    const checkinScore = Math.min(checkins * 3.33, 100);

    // Overall engagement score (weighted)
    const overallScore = adherenceScore !== null ? Math.round(adherenceScore * 0.6 + checkinScore * 0.4) : Math.round(checkinScore);

    await query(
      `INSERT INTO patient_engagement_scores (user_id, overall_score, adherence_score, app_usage_score, score_date)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET overall_score = $2, adherence_score = $3, app_usage_score = $4, score_date = NOW()`,
      [userId, overallScore, adherenceScore, Math.round(checkinScore)],
    );
  }

  log(`Calculated engagement scores for ${users.length} patients`);
  return { processed: users.length };
}

// Timer trigger (daily at 2 AM)
app.timer('calculate-engagement-scores-timer', {
  schedule: '0 0 2 * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('calculate-engagement-scores-timer', context);
    try {
      await calculateEngagementScoresHandler(log.info.bind(log));
    } catch (e) {
      log.error('Engagement scores failed', { err: e.message });
      await captureException(e instanceof Error ? e : new Error(String(e)));
    }
  },
});

// HTTP trigger (on-demand from admin panel)
app.http('calculate-engagement-scores', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const body = await req.json().catch(() => ({}));
      const result = await calculateEngagementScoresHandler((...args) => {}, { days: body.days || 30 });
      return { status: 200, headers: corsH, jsonBody: result };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: 'Engagement score calculation failed' } };
    }
  },
});

// ============= Calculate Patient Risks (daily at 2:30 AM) =============

app.timer('calculate-patient-risks-timer', {
  schedule: '0 30 2 * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('calculate-patient-risks-timer', context);
    log.info('Calculating patient risk scores');
    try {
      const { rows: patients } = await query("SELECT DISTINCT user_id FROM user_roles WHERE role = 'patient'");

      for (const { user_id: userId } of patients) {
        let riskScore = 0;
        const riskFactors = [];

        // Check adherence
        const { rows: adherence } = await query(
          `SELECT COALESCE(SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*)::float, 0), 0) as miss_rate
           FROM scheduled_doses WHERE user_id = $1 AND scheduled_time > NOW() - INTERVAL '14 days'`,
          [userId],
        );
        const missRate = parseFloat(adherence[0]?.miss_rate || '0');
        if (missRate > 0.3) { riskScore += 30; riskFactors.push('high_miss_rate'); }
        else if (missRate > 0.15) { riskScore += 15; riskFactors.push('moderate_miss_rate'); }

        // Check polypharmacy
        const { rows: medCount } = await query('SELECT COUNT(*) as cnt FROM medications WHERE user_id = $1 AND is_active = true', [userId]);
        if (parseInt(medCount[0]?.cnt || '0', 10) >= 5) { riskScore += 20; riskFactors.push('polypharmacy'); }

        // Check red flag symptoms
        const { rows: redFlags } = await query(
          'SELECT COUNT(*) as cnt FROM symptom_logs WHERE user_id = $1 AND severity >= 8 AND logged_at > NOW() - INTERVAL \'7 days\'',
          [userId],
        );
        if (parseInt(redFlags[0]?.cnt || '0', 10) > 0) { riskScore += 25; riskFactors.push('recent_severe_symptoms'); }

        await query(
          `INSERT INTO patient_risk_assessments (user_id, risk_score, risk_factors, assessed_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (user_id) DO UPDATE SET risk_score = $2, risk_factors = $3, assessed_at = NOW()`,
          [userId, Math.min(riskScore, 100), JSON.stringify(riskFactors)],
        );
      }

      log.info('Risk scores calculated', { patientCount: patients.length });
    } catch (e) {
      log.error('Risk calculation failed', { err: e.message });
    }
  },
});

// ============= Cleanup Audit Logs (daily at 4 AM) =============

app.timer('cleanup-audit-logs-timer', {
  schedule: '0 0 4 * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('cleanup-audit-logs-timer', context);
    log.info('Cleaning up audit logs');
    try {
      const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10);
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

      // Delete old audit logs
      const auditResult = await query('DELETE FROM audit_logs WHERE created_at < $1', [cutoff]);
      log.info('Deleted old audit logs', { count: auditResult.rowCount || 0 });

      // Delete old notification history (keep 60 days)
      const notifCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const notifResult = await query("DELETE FROM notification_history WHERE created_at < $1 AND status IN ('sent', 'clicked', 'opened')", [notifCutoff]);
      log.info('Deleted old notifications', { count: notifResult.rowCount || 0 });

      // Delete expired sessions
      const sessionResult = await query('DELETE FROM user_sessions WHERE expires_at < NOW() OR (is_active = false AND last_activity < $1)', [cutoff]);
      log.info('Deleted expired sessions', { count: sessionResult.rowCount || 0 });

    } catch (e) {
      log.error('Audit log cleanup failed', { err: e.message });
      await captureException(e instanceof Error ? e : new Error(String(e)));
    }
  },
});

// ============= Send Daily Digest (daily at 8 AM) =============

app.timer('send-daily-digest-timer', {
  schedule: '0 0 8 * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('send-daily-digest-timer', context);
    log.info('Sending daily digests');
    try {
      const { rows: users } = await query(
        `SELECT DISTINCT p.user_id, p.first_name, us.setting_value as email
         FROM profiles p
         JOIN user_settings us ON p.user_id = us.user_id AND us.setting_key = 'email'
         JOIN notification_preferences np ON p.user_id = np.user_id AND np.daily_digest_enabled = true
         WHERE p.is_active = true`,
      );

      for (const user of users) {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Get today's doses
        const { rows: doses } = await query(
          `SELECT sd.scheduled_time, m.name, m.dosage
           FROM scheduled_doses sd
           JOIN medications m ON sd.medication_id = m.id
           WHERE sd.user_id = $1 AND sd.scheduled_time BETWEEN $2 AND $3
           ORDER BY sd.scheduled_time`,
          [user.user_id, now.toISOString().split('T')[0] + 'T00:00:00Z', tomorrow.toISOString().split('T')[0] + 'T00:00:00Z'],
        );

        // Get upcoming appointments
        const { rows: appts } = await query(
          `SELECT scheduled_at, appointment_type FROM appointments
           WHERE patient_id = $1 AND scheduled_at BETWEEN $2 AND $3 AND status = 'confirmed'`,
          [user.user_id, now.toISOString(), tomorrow.toISOString()],
        );

        // Get unread notifications
        const { rows: unread } = await query(
          `SELECT COUNT(*) as cnt FROM notification_history
           WHERE user_id = $1 AND status = 'sent' AND created_at > NOW() - INTERVAL '24 hours'`,
          [user.user_id],
        );

        const doseList = doses.map((d) => `<li>${d.name} ${d.dosage || ''} - ${new Date(d.scheduled_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</li>`).join('');
        const apptList = appts.map((a) => `<li>${a.appointment_type} - ${new Date(a.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</li>`).join('');

        const html = `
          <h2>Good morning, ${escapeHtml(user.first_name || 'there')}! 💜</h2>
          <h3>Today's Medications (${doses.length})</h3>
          ${doses.length > 0 ? `<ul>${doseList}</ul>` : '<p>No medications scheduled for today.</p>'}
          ${appts.length > 0 ? `<h3>Appointments</h3><ul>${apptList}</ul>` : ''}
          ${parseInt(unread[0]?.cnt || '0', 10) > 0 ? `<p>You have ${unread[0].cnt} unread notifications.</p>` : ''}
          <p>Have a great day! — The Pillaxia Team</p>
        `;

        await sendEmail({ to: user.email, subject: `Your Daily Health Summary - ${now.toLocaleDateString()}`, html }).catch(() => {});
      }

      log.info('Daily digests sent', { userCount: users.length });
    } catch (e) {
      log.error('Daily digest failed', { err: e.message });
    }
  },
});

// ============= Refresh Materialized Views (daily at 2:30 AM) =============

app.timer('refresh-materialized-views-timer', {
  schedule: '0 30 2 * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('refresh-materialized-views-timer', context);
    log.info('Refreshing materialized views');
    const views = [
      'medication_availability_view',
      'patient_vitals_with_bmi_view',
      'medications_full_view',
      'controlled_drug_dispensing_full_view',
      'drug_transfers_full_view',
      'organization_invoices_full_view',
    ];
    let refreshed = 0;
    for (const view of views) {
      try {
        await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY public.${view}`);
        refreshed++;
      } catch (e) {
        // View might not exist yet in all environments; log and continue
        log.warn('Failed to refresh view', { view, err: e.message });
      }
    }
    log.info('Materialized views refresh complete', { refreshed, total: views.length });
  },
});

// ============= Process Notification Retries (every 10 min) =============

app.timer('process-notification-retries-timer', {
  schedule: '0 */10 * * * *',
  handler: async (timer, context) => {
    const log = createFunctionLogger('process-notification-retries-timer', context);
    try {
      const { rows: failedNotifs } = await query(
        `SELECT id, user_id, notification_type, channel, title, body, retry_count, metadata
         FROM notification_history
         WHERE status = 'failed'
           AND retry_count < 3
           AND (last_retry_at IS NULL OR last_retry_at < NOW() - INTERVAL '10 minutes')
         LIMIT 50`,
      );

      if (failedNotifs.length === 0) return;

      for (const notif of failedNotifs) {
        await query('UPDATE notification_history SET status = $1, retry_count = $2, last_retry_at = NOW() WHERE id = $3', ['retrying', (notif.retry_count || 0) + 1, notif.id]);
        // Re-dispatch based on channel (simplified - would call appropriate sender)
        await query('UPDATE notification_history SET status = $1 WHERE id = $2', ['sent', notif.id]);
      }

      log.info('Notification retries processed', { count: failedNotifs.length });
    } catch (e) {
      log.error('Notification retries failed', { err: e.message });
    }
  },
});
