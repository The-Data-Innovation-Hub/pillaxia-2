/**
 * Webhook Handler Functions
 * Ported from Supabase Edge Functions to Azure Functions v4
 *
 * Handles: Stripe, Resend, Twilio, appointment reply webhooks
 */

import { app } from '@azure/functions';
import { query } from '../shared/db.js';
import { getCorsHeaders } from '../shared/cors.js';
import { captureException, captureMessage } from '../shared/sentry.js';
import { getUserFromRequest, unauthorizedResponse } from '../shared/auth.js';
import { sendEmail } from '../shared/email/sendEmail.js';
import { escapeHtml } from '../shared/email/escapeHtml.js';

// ============= Resend Webhook =============

app.http('resend-webhook', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      const eventType = body.type;
      const data = body.data;

      if (!eventType || !data) return { status: 400, headers: corsH, jsonBody: { error: 'Invalid webhook payload' } };

      // Verify Resend webhook signature if configured
      const signingSecret = process.env.RESEND_WEBHOOK_SECRET;
      if (signingSecret) {
        const signature = req.headers.get('resend-signature');
        // Signature verification would go here
      }

      switch (eventType) {
        case 'email.sent':
          await query("UPDATE notification_history SET status = 'sent', provider_message_id = $1 WHERE provider_message_id = $2 OR metadata->>'resendId' = $2", [data.email_id, data.email_id]).catch(() => {});
          break;
        case 'email.delivered':
          await query("UPDATE notification_history SET status = 'delivered' WHERE provider_message_id = $1", [data.email_id]).catch(() => {});
          break;
        case 'email.opened':
          await query("UPDATE notification_history SET opened_at = NOW(), status = 'opened' WHERE provider_message_id = $1", [data.email_id]).catch(() => {});
          break;
        case 'email.clicked':
          await query("UPDATE notification_history SET clicked_at = NOW(), status = 'clicked' WHERE provider_message_id = $1", [data.email_id]).catch(() => {});
          break;
        case 'email.bounced':
          await query("UPDATE notification_history SET status = 'bounced', error_message = $1 WHERE provider_message_id = $2", [data.bounce?.description || 'Bounced', data.email_id]).catch(() => {});
          break;
        case 'email.complained':
          await query("UPDATE notification_history SET status = 'complained' WHERE provider_message_id = $1", [data.email_id]).catch(() => {});
          break;
        default:
          await captureMessage(`Unknown Resend webhook event: ${eventType}`);
      }

      return { status: 200, headers: corsH, jsonBody: { received: true } };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: 'Webhook processing failed' } };
    }
  },
});

// ============= Test Email Webhook =============

app.http('test-email-webhook', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      const body = await req.json();
      return { status: 200, headers: corsH, jsonBody: { received: true, type: body.type, timestamp: new Date().toISOString() } };
    } catch (e) {
      return { status: 500, headers: corsH, jsonBody: { error: 'Test webhook failed' } };
    }
  },
});

// ============= Twilio Webhook (SMS/WhatsApp status) =============

app.http('twilio-webhook', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      // Twilio sends form data, not JSON
      let formData;
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await req.text();
        formData = Object.fromEntries(new URLSearchParams(text));
      } else {
        formData = await req.json().catch(() => ({}));
      }

      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage, From, To, Body } = formData;

      if (MessageSid && MessageStatus) {
        const STATUS_MAP = {
          queued: 'queued',
          sent: 'sent',
          delivered: 'delivered',
          failed: 'failed',
          undelivered: 'failed',
        };

        const mappedStatus = STATUS_MAP[MessageStatus] || MessageStatus;
        await query(
          'UPDATE notification_history SET status = $1, error_message = $2 WHERE provider_message_id = $3',
          [mappedStatus, ErrorMessage || null, MessageSid],
        ).catch(() => {});
      }

      // If this is an inbound message (reply), log it
      if (Body && From && !MessageStatus) {
        await query(
          `INSERT INTO inbound_messages (from_number, to_number, body, provider_message_id, channel, received_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [From, To, Body, MessageSid, From?.startsWith('whatsapp:') ? 'whatsapp' : 'sms'],
        ).catch(() => {});
      }

      // Twilio expects TwiML response
      return { status: 200, headers: { ...corsH, 'Content-Type': 'text/xml' }, body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>' };
    } catch (e) {
      return { status: 200, headers: { 'Content-Type': 'text/xml' }, body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>' };
    }
  },
});

// ============= Twilio Video Token (action-based dispatch) =============

app.http('twilio-video-token', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };
    const user = getUserFromRequest(req);
    if (!user) return { ...unauthorizedResponse(), headers: corsH };

    try {
      const body = await req.json();
      const action = body.action || 'token'; // default to 'token' for backward compat

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const apiKeySid = process.env.TWILIO_API_KEY_SID;
      const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
      if (!accountSid || !apiKeySid || !apiKeySecret) {
        return { status: 500, headers: corsH, jsonBody: { error: 'Twilio video not configured' } };
      }

      const twilio = (await import('twilio')).default;

      // ── Action: create-room ───────────────────────────────
      if (action === 'create-room') {
        const { patientUserId, scheduledStart, appointmentId, isGroupCall, recordingEnabled } = body;
        const roomName = `pillaxia-${appointmentId || Date.now()}`;

        // Create room in Twilio
        const client = twilio(accountSid, apiKeySid, apiKeySecret);
        let roomSid = null;
        try {
          const room = await client.video.v1.rooms.create({
            uniqueName: roomName,
            type: isGroupCall ? 'group' : 'peer-to-peer',
            recordParticipantsOnConnect: recordingEnabled || false,
          });
          roomSid = room.sid;
        } catch (twilioErr) {
          // Room may already exist
          if (twilioErr.code === 53113) {
            const rooms = await client.video.v1.rooms.list({ uniqueName: roomName, limit: 1 });
            roomSid = rooms[0]?.sid || null;
          } else {
            throw twilioErr;
          }
        }

        // Persist to database
        const { rows } = await query(
          `INSERT INTO video_rooms (room_name, room_sid, clinician_user_id, patient_user_id, scheduled_start, appointment_id, is_group_call, recording_enabled, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'waiting')
           RETURNING *`,
          [roomName, roomSid, user.userId, patientUserId, scheduledStart, appointmentId || null, isGroupCall || false, recordingEnabled || false],
        );

        return { status: 200, headers: corsH, jsonBody: rows[0] };
      }

      // ── Action: token ─────────────────────────────────────
      if (action === 'token') {
        const { roomName, roomId } = body;
        if (!roomName) return { status: 400, headers: corsH, jsonBody: { error: 'roomName required' } };

        const AccessToken = twilio.jwt.AccessToken;
        const VideoGrant = AccessToken.VideoGrant;
        const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, { identity: user.userId });
        token.addGrant(new VideoGrant({ room: roomName }));

        // Check if the user is the host
        let isHost = false;
        if (roomId) {
          const { rows } = await query('SELECT clinician_user_id FROM video_rooms WHERE id = $1', [roomId]);
          isHost = rows[0]?.clinician_user_id === user.userId;
        }

        return { status: 200, headers: corsH, jsonBody: { token: token.toJwt(), roomName, isHost } };
      }

      // ── Action: admit-patient ─────────────────────────────
      if (action === 'admit-patient') {
        const { participantId, roomId } = body;
        if (!participantId || !roomId) return { status: 400, headers: corsH, jsonBody: { error: 'participantId and roomId required' } };

        await query(
          `UPDATE video_room_participants SET status = 'connected' WHERE id = $1 AND room_id = $2`,
          [participantId, roomId],
        );

        return { status: 200, headers: corsH, jsonBody: { success: true } };
      }

      // ── Action: end-call ──────────────────────────────────
      if (action === 'end-call') {
        const { roomId } = body;
        if (!roomId) return { status: 400, headers: corsH, jsonBody: { error: 'roomId required' } };

        await query(
          `UPDATE video_rooms SET status = 'completed', actual_end = NOW() WHERE id = $1`,
          [roomId],
        );

        // Try to end the Twilio room
        const { rows } = await query('SELECT room_sid FROM video_rooms WHERE id = $1', [roomId]);
        if (rows[0]?.room_sid) {
          try {
            const client = twilio(accountSid, apiKeySid, apiKeySecret);
            await client.video.v1.rooms(rows[0].room_sid).update({ status: 'completed' });
          } catch (twilioErr) {
            // Room may already be completed; ignore
          }
        }

        return { status: 200, headers: corsH, jsonBody: { success: true } };
      }

      return { status: 400, headers: corsH, jsonBody: { error: `Unknown action: ${action}` } };
    } catch (e) {
      await captureException(e instanceof Error ? e : new Error(String(e)));
      return { status: 500, headers: corsH, jsonBody: { error: 'Failed to handle video token request' } };
    }
  },
});

// ============= Appointment Reply Webhook =============

app.http('appointment-reply-webhook', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: async (req) => {
    const corsH = getCorsHeaders(req.headers.get('Origin'));
    if (req.method === 'OPTIONS') return { status: 204, headers: corsH };

    try {
      // Twilio sends form data
      const contentType = req.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const text = await req.text();
        data = Object.fromEntries(new URLSearchParams(text));
      } else {
        data = await req.json().catch(() => ({}));
      }

      const { From, Body } = data;
      if (!From || !Body) return { status: 200, headers: { 'Content-Type': 'text/xml' }, body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>' };

      const reply = Body.trim().toUpperCase();
      const phoneNumber = From.replace('whatsapp:', '').replace(/\D/g, '');

      // Find user by phone
      const { rows: profiles } = await query("SELECT user_id FROM profiles WHERE REPLACE(phone, '+', '') LIKE '%' || $1 || '%' LIMIT 1", [phoneNumber.slice(-10)]);
      if (profiles.length === 0) return { status: 200, headers: { 'Content-Type': 'text/xml' }, body: '<?xml version="1.0" encoding="UTF-8"?><Response><Message>We could not find your account.</Message></Response>' };

      const userId = profiles[0].user_id;

      // Find most recent pending appointment
      const { rows: appts } = await query(
        "SELECT id, scheduled_at FROM appointments WHERE patient_id = $1 AND status = 'pending' ORDER BY scheduled_at ASC LIMIT 1",
        [userId],
      );

      if (appts.length === 0) return { status: 200, headers: { 'Content-Type': 'text/xml' }, body: '<?xml version="1.0" encoding="UTF-8"?><Response><Message>No pending appointments found.</Message></Response>' };

      let responseMsg;
      if (reply === 'YES' || reply === 'Y' || reply === 'CONFIRM') {
        await query("UPDATE appointments SET status = 'confirmed' WHERE id = $1", [appts[0].id]);
        responseMsg = 'Your appointment has been confirmed! We look forward to seeing you.';
      } else if (reply === 'NO' || reply === 'N' || reply === 'CANCEL') {
        await query("UPDATE appointments SET status = 'cancelled_by_patient' WHERE id = $1", [appts[0].id]);
        responseMsg = 'Your appointment has been cancelled. Please reschedule at your convenience.';
      } else {
        responseMsg = 'Reply YES to confirm or NO to cancel your appointment.';
      }

      return { status: 200, headers: { 'Content-Type': 'text/xml' }, body: `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeHtml(responseMsg)}</Message></Response>` };
    } catch (e) {
      return { status: 200, headers: { 'Content-Type': 'text/xml' }, body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>' };
    }
  },
});

// ============= Stripe Webhook (already exists but ensure registration) =============
// Note: The existing stripe-webhook/index.js is already registered.
// This comment documents that it's part of the webhook handlers family.
