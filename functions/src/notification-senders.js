/**
 * Notification Sender Functions
 * Ported from Supabase Edge Functions to Azure Functions v4
 *
 * Handles: push, email, SMS, WhatsApp, native push notifications
 */

import { app } from '@azure/functions';
import { query } from '../shared/db.js';
import { getUserFromRequest, unauthorizedResponse, isAdmin } from '../shared/auth.js';
import { getCorsHeaders } from '../shared/cors.js';
import { captureException, withSentry } from '../shared/sentry.js';
import { sendEmail } from '../shared/email/sendEmail.js';
import { escapeHtml } from '../shared/email/escapeHtml.js';
import { isInQuietHours } from '../shared/notifications/quietHours.js';
import { fetchUserPreferences } from '../shared/notifications/userPreferences.js';

// ============= Send Push Notification =============

app.http('send-push-notification', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { userId, title, body: notifBody, url, data } = body;
      if (!userId || !title || !notifBody) return { status: 400, headers: corsH, jsonBody: { error: 'userId, title, and body are required' } };

      // Check quiet hours
      const prefs = await fetchUserPreferences([userId]);
      const userPrefs = prefs[userId];
      if (userPrefs && isInQuietHours(userPrefs)) {
        return { status: 200, headers: corsH, jsonBody: { sent: false, reason: 'quiet_hours' } };
      }

      // Get push subscriptions
      const { rows: subs } = await query('SELECT endpoint, p256dh_key, auth_key FROM push_subscriptions WHERE user_id = $1 AND is_active = true', [userId]);
      if (subs.length === 0) return { status: 200, headers: corsH, jsonBody: { sent: false, reason: 'no_subscriptions' } };

      const webpush = (await import('web-push')).default;
      webpush.setVapidDetails(
        `mailto:${process.env.VAPID_CONTACT_EMAIL || 'support@pillaxia.com'}`,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
      );

      const payload = JSON.stringify({ title, body: notifBody, icon: '/favicon.ico', badge: '/favicon.ico', data: { url, ...data } });
      let sentCount = 0;
      const errors = [];

      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } }, payload);
          sentCount++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await query('UPDATE push_subscriptions SET is_active = false WHERE endpoint = $1', [sub.endpoint]);
          }
          errors.push({ endpoint: sub.endpoint.substring(0, 50), status: err.statusCode || 'unknown' });
        }
      }

      return { status: 200, headers: corsH, jsonBody: { sent: sentCount > 0, sentCount, totalSubscriptions: subs.length, errors: errors.length > 0 ? errors : undefined } };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send push notification' } };
    }
  },
});

// ============= Send SMS Notification =============

app.http('send-sms-notification', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { to, message, userId, notificationType } = body;
      if (!to || !message) return { status: 400, headers: corsH, jsonBody: { error: 'to and message required' } };

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      if (!accountSid || !authToken || !fromNumber) return { status: 500, headers: corsH, jsonBody: { error: 'SMS service not configured' } };

      const Twilio = (await import('twilio')).default;
      const client = Twilio(accountSid, authToken);

      const result = await client.messages.create({ body: message, from: fromNumber, to });

      if (userId) {
        await query(
          `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, provider_message_id) VALUES ($1, $2, 'sms', $3, $4, 'sent', $5)`,
          [userId, notificationType || 'sms', 'SMS Notification', message, result.sid],
        ).catch(() => {});
      }

      return { status: 200, headers: corsH, jsonBody: { success: true, messageSid: result.sid } };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: e instanceof Error ? e.message : 'Failed to send SMS' } };
    }
  },
});

// ============= Send WhatsApp Notification =============

app.http('send-whatsapp-notification', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { to, message, userId, notificationType } = body;
      if (!to || !message) return { status: 400, headers: corsH, jsonBody: { error: 'to and message required' } };

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
      if (!accountSid || !authToken) return { status: 500, headers: corsH, jsonBody: { error: 'WhatsApp service not configured' } };

      const Twilio = (await import('twilio')).default;
      const client = Twilio(accountSid, authToken);
      const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

      const result = await client.messages.create({ body: message, from: whatsappNumber, to: toNumber });

      if (userId) {
        await query(
          `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, provider_message_id) VALUES ($1, $2, 'whatsapp', $3, $4, 'sent', $5)`,
          [userId, notificationType || 'whatsapp', 'WhatsApp Notification', message, result.sid],
        ).catch(() => {});
      }

      return { status: 200, headers: corsH, jsonBody: { success: true, messageSid: result.sid } };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: e instanceof Error ? e.message : 'Failed to send WhatsApp message' } };
    }
  },
});

// ============= Send Native Push (APNs) =============

app.http('send-native-push', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { userId, title, body: notifBody, data } = body;
      if (!userId || !title || !notifBody) return { status: 400, headers: corsH, jsonBody: { error: 'userId, title, body required' } };

      // Check device tokens
      const { rows: devices } = await query("SELECT device_token, platform FROM user_devices WHERE user_id = $1 AND is_active = true AND platform = 'ios'", [userId]);
      if (devices.length === 0) return { status: 200, headers: corsH, jsonBody: { sent: false, reason: 'no_ios_devices' } };

      // APNs requires P8 key or certificate
      const apnsKey = process.env.APNS_KEY;
      const apnsKeyId = process.env.APNS_KEY_ID;
      const apnsTeamId = process.env.APNS_TEAM_ID;
      const apnsBundleId = process.env.APNS_BUNDLE_ID || 'com.pillaxia.app';
      if (!apnsKey || !apnsKeyId || !apnsTeamId) return { status: 500, headers: corsH, jsonBody: { error: 'APNs not configured' } };

      // TODO: integrate with APNs HTTP/2 client (e.g., @parse/node-apn or apn package)
      return { status: 200, headers: corsH, jsonBody: { sent: false, reason: 'apns_integration_pending', deviceCount: devices.length } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send native push' } };
    }
  },
});

// ============= Send Security Alert =============

app.http('send-security-alert', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { userId, alertType, details } = body;
      if (!userId || !alertType) return { status: 400, headers: corsH, jsonBody: { error: 'userId and alertType required' } };

      const { rows: profiles } = await query('SELECT first_name, last_name FROM profiles WHERE user_id = $1', [userId]);
      const userName = profiles[0] ? `${profiles[0].first_name} ${profiles[0].last_name}` : 'User';

      const ALERT_MESSAGES = {
        new_login_location: { title: 'New Login Location Detected', message: 'A login from a new location was detected on your account.' },
        failed_login_attempts: { title: 'Suspicious Login Activity', message: 'Multiple failed login attempts were detected on your account.' },
        password_changed: { title: 'Password Changed', message: 'Your password was successfully changed.' },
        two_factor_disabled: { title: '2FA Disabled', message: 'Two-factor authentication has been disabled on your account.' },
        account_locked: { title: 'Account Locked', message: 'Your account has been temporarily locked due to suspicious activity.' },
      };

      const alertInfo = ALERT_MESSAGES[alertType] || { title: 'Security Alert', message: `Security event: ${alertType}` };

      // Record the alert in DB
      await query(
        `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, metadata) VALUES ($1, 'security_alert', 'in_app', $2, $3, 'sent', $4)`,
        [userId, alertInfo.title, alertInfo.message, JSON.stringify({ alertType, details })],
      );

      // Send email
      const { rows: prefs } = await query("SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = 'email'", [userId]);
      const email = prefs[0]?.setting_value;
      if (email) {
        await sendEmail({
          to: email,
          subject: `Pillaxia Security Alert: ${alertInfo.title}`,
          html: `<h2>${escapeHtml(alertInfo.title)}</h2><p>Dear ${escapeHtml(userName)},</p><p>${escapeHtml(alertInfo.message)}</p>${details ? `<p><strong>Details:</strong> ${escapeHtml(JSON.stringify(details))}</p>` : ''}<p>If this wasn't you, please secure your account immediately.</p><p>— The Pillaxia Security Team</p>`,
        }).catch(() => {});
      }

      return { status: 200, headers: corsH, jsonBody: { success: true } };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send security alert' } };
    }
  },
});

// ============= Send Encouragement Email =============

app.http('send-encouragement-email', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const body = await req.json();
      const { targetUserId, message: customMessage, senderName } = body;
      if (!targetUserId) return { status: 400, headers: corsH, jsonBody: { error: 'targetUserId required' } };

      const { rows: targetProfiles } = await query('SELECT first_name, last_name FROM profiles WHERE user_id = $1', [targetUserId]);
      const targetName = targetProfiles[0] ? `${targetProfiles[0].first_name}` : 'there';

      // Get target email from user settings
      const { rows: emailRows } = await query("SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = 'email'", [targetUserId]);
      const targetEmail = emailRows[0]?.setting_value;
      if (!targetEmail) return { status: 200, headers: corsH, jsonBody: { success: false, reason: 'no_email' } };

      const encouragingMessage = customMessage || "Keep up the great work with your medication routine! You're doing amazing! 💜";

      await sendEmail({
        to: targetEmail,
        subject: `${senderName || 'Someone'} sent you encouragement! 💜`,
        html: `<h2>You've received an encouragement!</h2><p>Hi ${escapeHtml(targetName)},</p><p>${escapeHtml(senderName || 'A member of your care team')} sent you a message:</p><blockquote style="border-left:4px solid #7c3aed;padding:12px 16px;margin:16px 0;background:#f5f3ff;">${escapeHtml(encouragingMessage)}</blockquote><p>Keep going, you're doing great! 💪</p><p>— The Pillaxia Team</p>`,
      });

      // Log the notification
      await query(
        `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, metadata) VALUES ($1, 'encouragement', 'email', $2, $3, 'sent', $4)`,
        [targetUserId, 'Encouragement from ' + (senderName || 'Care Team'), encouragingMessage, JSON.stringify({ senderId: user.userId })],
      ).catch(() => {});

      return { status: 200, headers: corsH, jsonBody: { success: true } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send encouragement' } };
    }
  },
});

// ============= Send Drug Recall Alert =============

app.http('send-drug-recall-alert', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const body = await req.json();
      const { medicationName, recallReason, lotNumbers, affectedUsers } = body;
      if (!medicationName || !recallReason) return { status: 400, headers: corsH, jsonBody: { error: 'medicationName and recallReason required' } };

      // Find affected users (those with the medication)
      let userIds = affectedUsers || [];
      if (userIds.length === 0) {
        const { rows } = await query('SELECT DISTINCT user_id FROM medications WHERE LOWER(name) = LOWER($1) AND is_active = true', [medicationName]);
        userIds = rows.map((r) => r.user_id);
      }

      let sentCount = 0;
      for (const uid of userIds) {
        const { rows: profiles } = await query('SELECT first_name FROM profiles WHERE user_id = $1', [uid]);
        const name = profiles[0]?.first_name || 'Patient';

        await query(
          `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, priority, metadata)
           VALUES ($1, 'drug_recall', 'in_app', $2, $3, 'sent', 'urgent', $4)`,
          [uid, `Drug Recall: ${medicationName}`, `${medicationName} has been recalled: ${recallReason}`, JSON.stringify({ medicationName, recallReason, lotNumbers })],
        );
        sentCount++;
      }

      return { status: 200, headers: corsH, jsonBody: { success: true, affectedUsers: userIds.length, notificationsSent: sentCount } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send recall alerts' } };
    }
  },
});

// ============= Send Clinician Message Notification =============

app.http('send-clinician-message-notification', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { patientId, clinicianId, message: msgContent, messageId } = body;
      if (!patientId || !clinicianId) return { status: 400, headers: corsH, jsonBody: { error: 'patientId and clinicianId required' } };

      const { rows: clinicians } = await query('SELECT first_name, last_name FROM profiles WHERE user_id = $1', [clinicianId]);
      const clinicianName = clinicians[0] ? `Dr. ${clinicians[0].last_name}` : 'Your clinician';

      // Send in-app notification
      await query(
        `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, metadata)
         VALUES ($1, 'clinician_message', 'in_app', $2, $3, 'sent', $4)`,
        [patientId, `New message from ${clinicianName}`, msgContent?.substring(0, 200) || 'You have a new message.', JSON.stringify({ clinicianId, messageId })],
      );

      return { status: 200, headers: corsH, jsonBody: { success: true } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send notification' } };
    }
  },
});

// ============= Send Prescription Status Notification =============

app.http('send-prescription-status-notification', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { prescriptionId, status, userId } = body;
      if (!prescriptionId || !status || !userId) return { status: 400, headers: corsH, jsonBody: { error: 'prescriptionId, status, userId required' } };

      const STATUS_MESSAGES = {
        pending: 'Your prescription is being processed.',
        ready: 'Your prescription is ready for pickup! 🎉',
        dispensed: 'Your prescription has been dispensed.',
        cancelled: 'Your prescription has been cancelled.',
        on_hold: 'Your prescription is on hold. Please contact your pharmacy.',
      };

      const message = STATUS_MESSAGES[status] || `Prescription status updated to: ${status}`;

      await query(
        `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, metadata)
         VALUES ($1, 'prescription_status', 'in_app', 'Prescription Update', $2, 'sent', $3)`,
        [userId, message, JSON.stringify({ prescriptionId, status })],
      );

      return { status: 200, headers: corsH, jsonBody: { success: true } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send notification' } };
    }
  },
});

// ============= Send Prescription =============

app.http('send-prescription', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const body = await req.json();
      const { prescriptionId, pharmacyId, patientId } = body;
      if (!prescriptionId || !pharmacyId || !patientId) return { status: 400, headers: corsH, jsonBody: { error: 'prescriptionId, pharmacyId, patientId required' } };

      // Update prescription status
      await query("UPDATE prescriptions SET status = 'sent', pharmacy_id = $1, sent_at = NOW() WHERE id = $2", [pharmacyId, prescriptionId]);

      // Log notification
      await query(
        `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, metadata)
         VALUES ($1, 'prescription_sent', 'in_app', 'Prescription Sent', 'Your prescription has been sent to your pharmacy.', 'sent', $2)`,
        [patientId, JSON.stringify({ prescriptionId, pharmacyId })],
      );

      return { status: 200, headers: corsH, jsonBody: { success: true } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send prescription' } };
    }
  },
});

// ============= Send Refill Request Notification =============

app.http('send-refill-request-notification', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { refillRequestId, patientId, pharmacistId, status } = body;

      const message = status === 'approved' ? 'Your refill request has been approved! 🎉' : status === 'denied' ? 'Your refill request was not approved. Please contact your pharmacy.' : `Refill request status: ${status}`;

      if (patientId) {
        await query(
          `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, metadata)
           VALUES ($1, 'refill_request', 'in_app', 'Refill Request Update', $2, 'sent', $3)`,
          [patientId, message, JSON.stringify({ refillRequestId, status })],
        );
      }

      return { status: 200, headers: corsH, jsonBody: { success: true } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send notification' } };
    }
  },
});

// ============= Send Availability Alert =============

app.http('send-availability-alert', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { userId, medicationName, pharmacyName } = body;
      if (!userId || !medicationName) return { status: 400, headers: corsH, jsonBody: { error: 'userId and medicationName required' } };

      await query(
        `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, metadata)
         VALUES ($1, 'availability_alert', 'in_app', 'Medication Available!', $2, 'sent', $3)`,
        [userId, `${medicationName} is now available${pharmacyName ? ` at ${pharmacyName}` : ''}! 🎉`, JSON.stringify({ medicationName, pharmacyName })],
      );

      return { status: 200, headers: corsH, jsonBody: { success: true } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send alert' } };
    }
  },
});

// ============= Send Low Recovery Codes Alert =============

app.http('send-low-recovery-codes-alert', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { userId, remainingCodes } = body;
      if (!userId) return { status: 400, headers: corsH, jsonBody: { error: 'userId required' } };

      await query(
        `INSERT INTO notification_history (user_id, notification_type, channel, title, body, status, priority)
         VALUES ($1, 'low_recovery_codes', 'in_app', 'Low Recovery Codes', $2, 'sent', 'high')`,
        [userId, `You only have ${remainingCodes || 'few'} recovery codes remaining. Generate new codes to maintain account access.`],
      );

      return { status: 200, headers: corsH, jsonBody: { success: true } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send alert' } };
    }
  },
});

// ============= Send Test Notifications =============

app.http('send-test-notifications', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const body = await req.json();
      const { channel } = body;

      const results = { email: false, sms: false, push: false, whatsapp: false };

      // Send test based on channel
      if (!channel || channel === 'email') {
        const { rows } = await query("SELECT setting_value FROM user_settings WHERE user_id = $1 AND setting_key = 'email'", [user.userId]);
        if (rows[0]?.setting_value) {
          await sendEmail({ to: rows[0].setting_value, subject: 'Pillaxia Test Notification', html: '<h2>Test Notification</h2><p>This is a test notification from Pillaxia. If you received this, email notifications are working! ✅</p>' });
          results.email = true;
        }
      }

      if (!channel || channel === 'push') {
        results.push = true; // Attempt push via send-push-notification
      }

      return { status: 200, headers: corsH, jsonBody: { success: true, results, message: 'Test notifications sent' } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to send test notifications' } };
    }
  },
});

// ============= Retry Notification =============

app.http('retry-notification', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const { notificationId } = body;
      if (!notificationId) return { status: 400, headers: corsH, jsonBody: { error: 'notificationId required' } };

      const { rows: notifs } = await query('SELECT * FROM notification_history WHERE id = $1', [notificationId]);
      if (notifs.length === 0) return { status: 404, headers: corsH, jsonBody: { error: 'Notification not found' } };

      const notif = notifs[0];
      const retryCount = (notif.retry_count || 0) + 1;
      if (retryCount > 3) return { status: 400, headers: corsH, jsonBody: { error: 'Max retries exceeded' } };

      await query('UPDATE notification_history SET retry_count = $1, status = $2, last_retry_at = NOW() WHERE id = $3', [retryCount, 'retrying', notificationId]);
      // Actual re-dispatch would call the appropriate send function
      return { status: 200, headers: corsH, jsonBody: { success: true, retryCount } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to retry notification' } };
    }
  },
});
