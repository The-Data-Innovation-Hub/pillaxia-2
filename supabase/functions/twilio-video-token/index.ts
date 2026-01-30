import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { validators, validateSchema, validationErrorResponse } from "../_shared/validation.ts";
import { withSentry, captureException } from "../_shared/sentry.ts";

// Validation schemas for different actions
const createRoomSchema = {
  patientUserId: validators.uuid(),
  scheduledStart: validators.string({ minLength: 1 }),
  appointmentId: validators.optional(validators.uuid()),
  isGroupCall: validators.optional(validators.boolean()),
  recordingEnabled: validators.optional(validators.boolean()),
};

const tokenRequestSchema = {
  roomName: validators.string({ minLength: 1, maxLength: 100 }),
  roomId: validators.optional(validators.uuid()),
};

const admitPatientSchema = {
  participantId: validators.uuid(),
  roomId: validators.uuid(),
};

const endCallSchema = {
  roomId: validators.uuid(),
};

Deno.serve(withSentry("twilio-video-token", async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioApiKey = Deno.env.get('TWILIO_API_KEY');
    const twilioApiSecret = Deno.env.get('TWILIO_API_SECRET');

    // Validate Twilio configuration
    if (!twilioAccountSid || !twilioApiKey || !twilioApiSecret) {
      console.error("Twilio credentials not configured");
      return new Response(JSON.stringify({ error: "Video service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // JWT Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const userId = claimsData.claims.sub as string;
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    // Get user profile for identity
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('user_id', userId)
      .single();

    const userIdentity = profile 
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || userId
      : userId;

    if (req.method === 'POST') {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create a new video room
      if (action === 'create-room') {
        const validation = validateSchema(createRoomSchema, body);
        if (!validation.success) {
          return validationErrorResponse(validation, corsHeaders);
        }

        const { appointmentId, patientUserId, scheduledStart, isGroupCall, recordingEnabled } = validation.data;
        
        // Generate unique room name
        const roomName = `pillaxia-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Create Twilio room
        const twilioResponse = await fetch(
          `https://video.twilio.com/v1/Rooms`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioApiKey}:${twilioApiSecret}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              UniqueName: roomName,
              Type: isGroupCall ? 'group' : 'group-small',
              RecordParticipantsOnConnect: recordingEnabled ? 'true' : 'false',
              StatusCallback: `${supabaseUrl}/functions/v1/twilio-video-webhook`,
            }),
          }
        );

        const twilioRoom = await twilioResponse.json();
        
        if (!twilioResponse.ok) {
          console.error('Twilio room creation failed:', twilioRoom);
          captureException(new Error(`Twilio room creation failed: ${JSON.stringify(twilioRoom)}`));
          return new Response(JSON.stringify({ error: 'Failed to create video room', details: twilioRoom }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Save room to database
        const { data: videoRoom, error: roomError } = await supabase
          .from('video_rooms')
          .insert({
            room_name: roomName,
            room_sid: twilioRoom.sid,
            appointment_id: appointmentId || null,
            clinician_user_id: userId,
            patient_user_id: patientUserId,
            scheduled_start: scheduledStart,
            is_group_call: isGroupCall || false,
            recording_enabled: recordingEnabled || false,
          })
          .select()
          .single();

        if (roomError) {
          console.error('Database error:', roomError);
          captureException(roomError);
          return new Response(JSON.stringify({ error: 'Failed to save room' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // If appointment exists, link it
        if (appointmentId) {
          await supabase
            .from('appointments')
            .update({ video_room_id: videoRoom.id, is_video_call: true })
            .eq('id', appointmentId);
        }

        console.log('Video room created:', videoRoom.id);

        return new Response(JSON.stringify({ 
          success: true, 
          room: videoRoom,
          twilioRoom: { sid: twilioRoom.sid, uniqueName: twilioRoom.unique_name }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate access token for joining a room
      if (action === 'token') {
        const validation = validateSchema(tokenRequestSchema, body);
        if (!validation.success) {
          return validationErrorResponse(validation, corsHeaders);
        }

        const { roomName } = validation.data;

        // Verify user has access to this room
        const { data: room, error: roomError } = await supabase
          .from('video_rooms')
          .select('*')
          .eq('room_name', roomName)
          .single();

        if (roomError || !room) {
          return new Response(JSON.stringify({ error: 'Room not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Check if user is authorized (clinician, patient, or admin)
        const isAuthorized = 
          room.clinician_user_id === userId || 
          room.patient_user_id === userId;

        if (!isAuthorized) {
          // Check if user is a caregiver
          const { data: caregiverCheck } = await supabase.rpc('is_caregiver_for_patient', {
            _patient_user_id: room.patient_user_id,
            _caregiver_user_id: userId
          });

          if (!caregiverCheck) {
            return new Response(JSON.stringify({ error: 'Not authorized for this room' }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }

        // Generate Twilio access token
        const AccessToken = await generateTwilioAccessToken({
          accountSid: twilioAccountSid,
          apiKey: twilioApiKey,
          apiSecret: twilioApiSecret,
          identity: userIdentity,
          roomName: roomName,
        });

        // Update/insert participant record
        const participantType = room.clinician_user_id === userId ? 'clinician' : 'patient';
        
        const { data: existingParticipant } = await supabase
          .from('video_room_participants')
          .select('id')
          .eq('room_id', room.id)
          .eq('user_id', userId)
          .single();

        if (existingParticipant) {
          await supabase
            .from('video_room_participants')
            .update({ 
              joined_at: new Date().toISOString(),
              left_at: null,
              is_in_waiting_room: participantType === 'patient'
            })
            .eq('id', existingParticipant.id);
        } else {
          await supabase
            .from('video_room_participants')
            .insert({
              room_id: room.id,
              user_id: userId,
              participant_type: participantType,
              is_in_waiting_room: participantType === 'patient',
            });
        }

        console.log('Token generated for user:', userId, 'room:', roomName);

        return new Response(JSON.stringify({ 
          token: AccessToken,
          identity: userIdentity,
          roomName: roomName,
          roomId: room.id,
          isHost: room.clinician_user_id === userId,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Admit patient from waiting room
      if (action === 'admit-patient') {
        const validation = validateSchema(admitPatientSchema, body);
        if (!validation.success) {
          return validationErrorResponse(validation, corsHeaders);
        }

        const { participantId, roomId } = validation.data;

        // Verify clinician owns the room
        const { data: room } = await supabase
          .from('video_rooms')
          .select('clinician_user_id')
          .eq('id', roomId)
          .single();

        if (!room || room.clinician_user_id !== userId) {
          return new Response(JSON.stringify({ error: 'Not authorized' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Admit the patient
        const { error: updateError } = await supabase
          .from('video_room_participants')
          .update({ 
            is_in_waiting_room: false, 
            admitted_at: new Date().toISOString(),
            admitted_by: userId
          })
          .eq('id', participantId);

        if (updateError) {
          captureException(updateError);
          return new Response(JSON.stringify({ error: 'Failed to admit patient' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Update room status
        await supabase
          .from('video_rooms')
          .update({ 
            status: 'in_progress',
            actual_start: new Date().toISOString()
          })
          .eq('id', roomId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // End call
      if (action === 'end-call') {
        const validation = validateSchema(endCallSchema, body);
        if (!validation.success) {
          return validationErrorResponse(validation, corsHeaders);
        }

        const { roomId } = validation.data;

        // Verify user is part of the room
        const { data: room } = await supabase
          .from('video_rooms')
          .select('*')
          .eq('id', roomId)
          .single();

        if (!room || (room.clinician_user_id !== userId && room.patient_user_id !== userId)) {
          return new Response(JSON.stringify({ error: 'Not authorized' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // End the Twilio room
        if (room.room_sid) {
          await fetch(
            `https://video.twilio.com/v1/Rooms/${room.room_sid}`,
            {
              method: 'POST',
              headers: {
                'Authorization': 'Basic ' + btoa(`${twilioApiKey}:${twilioApiSecret}`),
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({ Status: 'completed' }),
            }
          );
        }

        // Update room status
        await supabase
          .from('video_rooms')
          .update({ 
            status: 'completed',
            actual_end: new Date().toISOString()
          })
          .eq('id', roomId);

        // Update all participants
        await supabase
          .from('video_room_participants')
          .update({ left_at: new Date().toISOString() })
          .eq('room_id', roomId)
          .is('left_at', null);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in twilio-video-token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (error instanceof Error) captureException(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}));

// Generate Twilio Video Access Token
async function generateTwilioAccessToken(params: {
  accountSid: string;
  apiKey: string;
  apiSecret: string;
  identity: string;
  roomName: string;
}): Promise<string> {
  const { accountSid, apiKey, apiSecret, identity, roomName } = params;

  // Create JWT header
  const header = {
    typ: 'JWT',
    alg: 'HS256',
    cty: 'twilio-fpa;v=1'
  };

  // Create JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    jti: `${apiKey}-${now}`,
    iss: apiKey,
    sub: accountSid,
    iat: now,
    exp: now + 3600, // 1 hour
    grants: {
      identity: identity,
      video: {
        room: roomName
      }
    }
  };

  // Encode and sign
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const signature = await signHS256(signatureInput, apiSecret);
  
  return `${signatureInput}.${signature}`;
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signHS256(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
