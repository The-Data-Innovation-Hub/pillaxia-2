import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiInvoke,
  listVideoRooms,
  getVideoRoom,
  listVideoRoomParticipants,
  getVideoCallNotes,
  upsertVideoCallNotes,
} from '@/integrations/azure/data';
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
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  // Fetch room details
  const { data: room, isLoading: roomLoading } = useQuery({
    queryKey: ['video-room', roomId],
    queryFn: async () => {
      if (!roomId) return null;
      const data = await getVideoRoom(roomId);
      return data as VideoRoom;
    },
    enabled: !!roomId,
  });

  // Fetch participants (refetch periodically instead of realtime)
  const { data: participants = [], refetch: refetchParticipants } = useQuery({
    queryKey: ['video-room-participants', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      const participantData = await listVideoRoomParticipants(roomId);
      const userIds = [...new Set((participantData || []).map((p: Record<string, unknown>) => p.user_id as string))];
      const profileData = userIds.length
        ? await import('@/integrations/azure/data').then((m) => m.listProfilesByUserIds(userIds))
        : [];
      return (participantData || []).map((p: Record<string, unknown>) => ({
        ...p,
        profile: profileData.find((pr: Record<string, unknown>) => pr.user_id === p.user_id) || undefined,
      })) as VideoRoomParticipant[];
    },
    enabled: !!roomId,
    refetchInterval: 5000,
  });

  // Realtime replaced by refetchInterval on participants query above

  // Create room mutation
  const createRoom = useMutation({
    mutationFn: async (params: {
      patientUserId: string;
      scheduledStart: string;
      appointmentId?: string;
      isGroupCall?: boolean;
      recordingEnabled?: boolean;
    }) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await apiInvoke('twilio-video-token/create-room', params);
      if (error) throw new Error(error.message);
      return data;
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
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await apiInvoke<{ token: string; roomName: string; isHost: boolean }>(
        'twilio-video-token/token',
        { roomName: roomNameParam, roomId }
      );
      if (error) throw new Error(error.message);
      setAccessToken(data!.token);
      setRoomName(data!.roomName);
      setIsHost(data!.isHost);
      return data!;
    } catch (error) {
      console.error('Failed to get token:', error);
      toast.error('Failed to connect to video call');
      throw error;
    }
  }, [roomId, session?.access_token]);

  // Admit patient from waiting room
  const admitPatient = useMutation({
    mutationFn: async (participantId: string) => {
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await apiInvoke('twilio-video-token/admit-patient', {
        participantId,
        roomId,
      });
      if (error) throw new Error(error.message);
      return data;
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
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await apiInvoke('twilio-video-token/end-call', { roomId });
      if (error) throw new Error(error.message);
      return data;
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
      const data = await listVideoRooms({ user_id: user.id });
      const sorted = (data || []).sort(
        (a, b) =>
          new Date((b.scheduled_start as string) || 0).getTime() -
          new Date((a.scheduled_start as string) || 0).getTime()
      );
      return sorted as VideoRoom[];
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
      const data = await getVideoCallNotes(roomId);
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
      const room = await getVideoRoom(roomId);
      if (!room) throw new Error('Room not found');

      const noteData: Record<string, unknown> = {
        room_id: roomId,
        clinician_user_id: user?.id,
        patient_user_id: room.patient_user_id,
        subjective: params.subjective || null,
        objective: params.objective || null,
        assessment: params.assessment || null,
        plan: params.plan || null,
        is_draft: params.isDraft ?? true,
      };
      if (notes?.id) noteData.id = notes.id;

      const data = await upsertVideoCallNotes(noteData);
      return data;
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
