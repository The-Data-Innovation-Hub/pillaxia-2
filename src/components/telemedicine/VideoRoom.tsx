import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, 
  MonitorUp, Users, FileText, Pill, Clock,
  UserCheck, AlertCircle, Maximize, Minimize
} from 'lucide-react';
import { useVideoCall, useVideoCallNotes } from '@/hooks/useVideoCall';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function VideoRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { 
    room, 
    roomLoading, 
    participants, 
    waitingRoomParticipants, 
    activeParticipants,
    accessToken,
    isHost,
    getToken,
    admitPatient,
    endCall 
  } = useVideoCall(roomId);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('waiting-room');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Connect to room when we have token
  useEffect(() => {
    if (room && !accessToken) {
      getToken(room.room_name);
    }
  }, [room, accessToken, getToken]);

  // Setup local video preview
  useEffect(() => {
    async function setupLocalVideo() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to access media devices:', error);
        toast.error('Failed to access camera/microphone');
      }
    }
    
    if (accessToken) {
      setupLocalVideo();
    }

    return () => {
      if (localVideoRef.current?.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [accessToken]);

  const toggleVideo = useCallback(() => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(track => {
        track.enabled = !isVideoEnabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [isVideoEnabled]);

  const toggleAudio = useCallback(() => {
    if (localVideoRef.current?.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
    }
  }, [isAudioEnabled]);

  const handleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        // In a real implementation, you'd share this stream
        setIsScreenSharing(true);
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
        };
      } else {
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Screen share error:', error);
    }
  };

  const handleEndCall = async () => {
    await endCall.mutateAsync();
    navigate(-1);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (roomLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Room not found</h2>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex h-screen bg-background">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col">
        {/* Video Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Badge variant={room.status === 'in_progress' ? 'default' : 'secondary'}>
              {room.status === 'in_progress' ? 'Live' : room.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {room.is_group_call ? 'Group Call' : '1:1 Consultation'}
            </span>
            {room.recording_enabled && (
              <Badge variant="destructive" className="gap-1">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Recording
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Video Grid */}
        <div className="flex-1 p-4 bg-muted/30">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            {/* Remote Video */}
            <div 
              ref={remoteVideoRef}
              className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center"
            >
              {activeParticipants.length > 0 ? (
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50">
                  <div className="absolute bottom-4 left-4 text-white">
                    <p className="font-medium">Remote Participant</p>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2" />
                  <p>Waiting for participant to join...</p>
                </div>
              )}
            </div>

            {/* Local Video */}
            <div className="relative bg-muted rounded-lg overflow-hidden">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={cn(
                  "w-full h-full object-cover",
                  !isVideoEnabled && "hidden"
                )}
              />
              {!isVideoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <VideoOff className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="absolute bottom-4 left-4 text-white bg-black/50 px-2 py-1 rounded">
                <p className="text-sm font-medium">You</p>
              </div>
            </div>
          </div>
        </div>

        {/* Video Controls */}
        <div className="flex items-center justify-center gap-4 p-4 border-t bg-background">
          <Button
            variant={isAudioEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="rounded-full w-14 h-14"
            onClick={toggleAudio}
          >
            {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </Button>
          
          <Button
            variant={isVideoEnabled ? 'secondary' : 'destructive'}
            size="lg"
            className="rounded-full w-14 h-14"
            onClick={toggleVideo}
          >
            {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </Button>
          
          <Button
            variant={isScreenSharing ? 'default' : 'secondary'}
            size="lg"
            className="rounded-full w-14 h-14"
            onClick={handleScreenShare}
          >
            <MonitorUp className="h-6 w-6" />
          </Button>
          
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full w-14 h-14"
            onClick={handleEndCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      {isHost && (
        <div className="w-80 border-l bg-background flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-3 m-2">
              <TabsTrigger value="waiting-room" className="relative">
                <Users className="h-4 w-4" />
                {waitingRoomParticipants.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {waitingRoomParticipants.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="notes">
                <FileText className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="prescribe">
                <Pill className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="waiting-room" className="flex-1 p-4 m-0">
              <WaitingRoomPanel 
                participants={waitingRoomParticipants}
                onAdmit={(id) => admitPatient.mutate(id)}
              />
            </TabsContent>

            <TabsContent value="notes" className="flex-1 p-4 m-0">
              {roomId && <NotesPanel roomId={roomId} />}
            </TabsContent>

            <TabsContent value="prescribe" className="flex-1 p-4 m-0">
              <PrescribePanel />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

// Waiting Room Panel Component
function WaitingRoomPanel({ 
  participants, 
  onAdmit 
}: { 
  participants: any[];
  onAdmit: (id: string) => void;
}) {
  if (participants.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Clock className="h-8 w-8 mx-auto mb-2" />
        <p>No patients waiting</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Waiting Room ({participants.length})</h3>
        {participants.map((participant) => (
          <Card key={participant.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {participant.profile?.first_name?.[0] || 'P'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">
                    {participant.profile?.first_name} {participant.profile?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Waiting since {new Date(participant.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => onAdmit(participant.id)}>
                <UserCheck className="h-4 w-4 mr-1" />
                Admit
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

// Notes Panel Component
function NotesPanel({ roomId }: { roomId: string }) {
  const { notes, saveNotes } = useVideoCallNotes(roomId);
  const [formData, setFormData] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  useEffect(() => {
    if (notes) {
      setFormData({
        subjective: notes.subjective || '',
        objective: notes.objective || '',
        assessment: notes.assessment || '',
        plan: notes.plan || '',
      });
    }
  }, [notes]);

  const handleSave = (isDraft: boolean) => {
    saveNotes.mutate({ ...formData, isDraft });
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4">
        <h3 className="font-semibold text-sm">SOAP Notes</h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Subjective</label>
            <Textarea
              placeholder="Patient's symptoms, concerns..."
              value={formData.subjective}
              onChange={(e) => setFormData(prev => ({ ...prev, subjective: e.target.value }))}
              className="mt-1 text-sm"
              rows={3}
            />
          </div>
          
          <div>
            <label className="text-xs font-medium text-muted-foreground">Objective</label>
            <Textarea
              placeholder="Observations, vitals..."
              value={formData.objective}
              onChange={(e) => setFormData(prev => ({ ...prev, objective: e.target.value }))}
              className="mt-1 text-sm"
              rows={3}
            />
          </div>
          
          <div>
            <label className="text-xs font-medium text-muted-foreground">Assessment</label>
            <Textarea
              placeholder="Diagnosis, clinical impression..."
              value={formData.assessment}
              onChange={(e) => setFormData(prev => ({ ...prev, assessment: e.target.value }))}
              className="mt-1 text-sm"
              rows={3}
            />
          </div>
          
          <div>
            <label className="text-xs font-medium text-muted-foreground">Plan</label>
            <Textarea
              placeholder="Treatment plan, follow-up..."
              value={formData.plan}
              onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value }))}
              className="mt-1 text-sm"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => handleSave(true)}
            disabled={saveNotes.isPending}
          >
            Save Draft
          </Button>
          <Button 
            size="sm" 
            className="flex-1"
            onClick={() => handleSave(false)}
            disabled={saveNotes.isPending}
          >
            Finalize
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

// Prescribe Panel Component
function PrescribePanel() {
  return (
    <div className="text-center text-muted-foreground py-8">
      <Pill className="h-8 w-8 mx-auto mb-2" />
      <p className="text-sm">E-Prescribe during call</p>
      <p className="text-xs mt-1">Coming soon</p>
    </div>
  );
}

export default VideoRoom;
