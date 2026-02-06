import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/integrations/db';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface VideoRoom {
  id: string;
  room_name: string;
  room_sid: string | null;
  appointment_id: string | null;
  clinician_user_id: string;
  patient_user_id: string;
  status: string;
  scheduled_start: string;
  actual_start: string | null;
  actual_end: string | null;
  is_group_call: boolean;
  recording_enabled: boolean;
  recording_sid: string | null;
  recording_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoRoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  participant_type: string;
  joined_at: string | null;
  left_at: string | null;
  is_in_waiting_room: boolean;
  admitted_at: string | null;
  admitted_by: string | null;
  connection_quality: string | null;
  created_at: string;
  profile?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export interface VideoCallNotes {
  id: string;
  room_id: string;
  clinician_user_id: string;
  patient_user_id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
}

export function useVideoCall(roomId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  // Fetch room details
  const { data: room, isLoading: roomLoading } = useQuery({
    queryKey: ['video-room', roomId],
    queryFn: async () => {
      if (!roomId) return null;
      const { data, error } = await db
        .from('video_rooms')
        .select('*')
        .eq('id', roomId)
        .single();
      if (error) throw error;
      return data as VideoRoom;
    },
    enabled: !!roomId,
  });

  // Fetch participants
  const { data: participants = [], refetch: refetchParticipants } = useQuery({
    queryKey: ['video-room-participants', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      
      // Get participants
      const { data: participantData, error: participantError } = await db
        .from('video_room_participants')
        .select('*')
        .eq('room_id', roomId);
      
      if (participantError) throw participantError;
      
      // Get profiles separately
      const userIds = participantData?.map(p => p.user_id) || [];
      const { data: profileData } = await db
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', userIds);
      
      // Merge participants with profiles
      return (participantData || []).map(p => ({
        ...p,
        profile: profileData?.find(pr => pr.user_id === p.user_id) || undefined,
      })) as VideoRoomParticipant[];
    },
    enabled: !!roomId,
  });

  // Poll for updates (replaces Supabase realtime)
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(() => {
      refetchParticipants();
      queryClient.invalidateQueries({ queryKey: ['video-room', roomId] });
    }, 5000);
    return () => clearInterval(interval);
  }, [roomId, refetchParticipants, queryClient]);

  // Create room mutation
  const createRoom = useMutation({
    mutationFn: async (params: {
      patientUserId: string;
      scheduledStart: string;
      appointmentId?: string;
      isGroupCall?: boolean;
      recordingEnabled?: boolean;
    }) => {
      if (!user) throw new Error('Not authenticated');

      const response = await db.functions.invoke('twilio-video-token', {
        body: { action: 'create-room', ...params },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Video room created');
      queryClient.invalidateQueries({ queryKey: ['video-rooms'] });
      return data;
    },
    onError: (error) => {
      toast.error('Failed to create video room: ' + error.message);
    },
  });

  // Get access token
  const getToken = useCallback(async (roomNameParam: string) => {
    try {
      if (!user) throw new Error('Not authenticated');

      const response = await db.functions.invoke('twilio-video-token', {
        body: { action: 'token', roomName: roomNameParam, roomId },
      });

      if (response.error) throw new Error(response.error.message);
      
      setAccessToken(response.data.token);
      setRoomName(response.data.roomName);
      setIsHost(response.data.isHost);
      
      return response.data;
    } catch (error) {
      console.error('Failed to get token:', error);
      toast.error('Failed to connect to video call');
      throw error;
    }
  }, [roomId]);

  // Admit patient from waiting room
  const admitPatient = useMutation({
    mutationFn: async (participantId: string) => {
      if (!user) throw new Error('Not authenticated');

      const response = await db.functions.invoke('twilio-video-token', {
        body: { action: 'admit-patient', participantId, roomId },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Patient admitted');
      refetchParticipants();
    },
    onError: (error) => {
      toast.error('Failed to admit patient: ' + error.message);
    },
  });

  // End call
  const endCall = useMutation({
    mutationFn: async () => {
      if (!roomId) throw new Error('No room ID');
      
      if (!user) throw new Error('Not authenticated');

      const response = await db.functions.invoke('twilio-video-token', {
        body: { action: 'end-call', roomId },
      });

      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Call ended');
      setAccessToken(null);
      queryClient.invalidateQueries({ queryKey: ['video-room', roomId] });
    },
    onError: (error) => {
      toast.error('Failed to end call: ' + error.message);
    },
  });

  // Waiting room helpers
  const waitingRoomParticipants = participants.filter(p => p.is_in_waiting_room);
  const activeParticipants = participants.filter(p => !p.is_in_waiting_room && !p.left_at);

  return {
    room,
    roomLoading,
    participants,
    waitingRoomParticipants,
    activeParticipants,
    accessToken,
    roomName,
    isHost,
    createRoom,
    getToken,
    admitPatient,
    endCall,
  };
}

// Hook for fetching user's video rooms
export function useVideoRooms() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['video-rooms', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await db
        .from('video_rooms')
        .select('*')
        .or(`clinician_user_id.eq.${user.id},patient_user_id.eq.${user.id}`)
        .order('scheduled_start', { ascending: false });
      
      if (error) throw error;
      return data as VideoRoom[];
    },
    enabled: !!user?.id,
  });
}

// Hook for call notes
export function useVideoCallNotes(roomId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes, isLoading } = useQuery({
    queryKey: ['video-call-notes', roomId],
    queryFn: async () => {
      const { data, error } = await db
        .from('video_call_notes')
        .select('*')
        .eq('room_id', roomId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as VideoCallNotes | null;
    },
    enabled: !!roomId,
  });

  const saveNotes = useMutation({
    mutationFn: async (params: {
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      isDraft?: boolean;
    }) => {
      const { data: room } = await db
        .from('video_rooms')
        .select('patient_user_id')
        .eq('id', roomId)
        .single();

      if (!room) throw new Error('Room not found');

      const noteData = {
        room_id: roomId,
        clinician_user_id: user?.id,
        patient_user_id: room.patient_user_id,
        subjective: params.subjective || null,
        objective: params.objective || null,
        assessment: params.assessment || null,
        plan: params.plan || null,
        is_draft: params.isDraft ?? true,
      };

      if (notes?.id) {
        const { data, error } = await db
          .from('video_call_notes')
          .update(noteData)
          .eq('id', notes.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await db
          .from('video_call_notes')
          .insert(noteData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-call-notes', roomId] });
      toast.success('Notes saved');
    },
    onError: (error) => {
      toast.error('Failed to save notes: ' + error.message);
    },
  });

  return {
    notes,
    isLoading,
    saveNotes,
  };
}
