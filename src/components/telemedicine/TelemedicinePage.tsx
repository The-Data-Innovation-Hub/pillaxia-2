import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Video, Calendar, Clock, Users, Plus, 
  PhoneCall, MonitorPlay, FileText, History
} from 'lucide-react';
import { useVideoCall, useVideoRooms, VideoRoom } from '@/hooks/useVideoCall';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns';

export function TelemedicinePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: videoRooms = [], isLoading } = useVideoRooms();
  const { createRoom } = useVideoCall();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');

  // Fetch assigned patients for clinicians
  const { data: assignedPatients = [] } = useQuery({
    queryKey: ['assigned-patients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinician_patient_assignments')
        .select(`
          patient_user_id,
          patient:profiles!clinician_patient_assignments_patient_user_id_fkey(
            user_id, first_name, last_name, email
          )
        `)
        .eq('clinician_user_id', user?.id);
      
      if (error) {
        // Fallback query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('clinician_patient_assignments')
          .select('patient_user_id')
          .eq('clinician_user_id', user?.id);
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      }
      return data || [];
    },
    enabled: !!user?.id,
  });

  const upcomingRooms = videoRooms.filter(r => 
    isFuture(parseISO(r.scheduled_start)) || 
    (isToday(parseISO(r.scheduled_start)) && r.status !== 'completed')
  );
  
  const pastRooms = videoRooms.filter(r => 
    isPast(parseISO(r.scheduled_start)) && r.status === 'completed'
  );

  const handleCreateRoom = async (data: {
    patientUserId: string;
    scheduledStart: string;
    isGroupCall: boolean;
    recordingEnabled: boolean;
  }) => {
    await createRoom.mutateAsync(data);
    setIsCreateDialogOpen(false);
  };

  const handleJoinRoom = (room: VideoRoom) => {
    navigate(`/dashboard/telemedicine/room/${room.id}`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Telemedicine</h1>
          <p className="text-muted-foreground">Video consultations with patients</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Video Call
            </Button>
          </DialogTrigger>
          <CreateRoomDialog 
            patients={assignedPatients}
            onSubmit={handleCreateRoom}
            isLoading={createRoom.isPending}
          />
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upcomingRooms.length}</p>
              <p className="text-sm text-muted-foreground">Upcoming Calls</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-chart-2/10 rounded-lg">
              <PhoneCall className="h-6 w-6 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {videoRooms.filter(r => r.status === 'in_progress').length}
              </p>
              <p className="text-sm text-muted-foreground">Active Now</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-chart-1/10 rounded-lg">
              <History className="h-6 w-6 text-chart-1" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pastRooms.length}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-chart-4/10 rounded-lg">
              <Users className="h-6 w-6 text-chart-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{assignedPatients.length}</p>
              <p className="text-sm text-muted-foreground">Patients</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Lists */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming">
            <Calendar className="h-4 w-4 mr-2" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : upcomingRooms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No upcoming video calls</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Schedule a new video consultation with a patient
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Call
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {upcomingRooms.map((room) => (
                <RoomCard key={room.id} room={room} onJoin={() => handleJoinRoom(room)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {pastRooms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold mb-2">No call history</h3>
                <p className="text-muted-foreground text-sm">
                  Completed video consultations will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pastRooms.map((room) => (
                <RoomCard key={room.id} room={room} isPast />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Room Card Component
function RoomCard({ 
  room, 
  onJoin, 
  isPast 
}: { 
  room: VideoRoom; 
  onJoin?: () => void;
  isPast?: boolean;
}) {
  const scheduledDate = parseISO(room.scheduled_start);
  const isLive = room.status === 'in_progress';
  
  return (
    <Card className={isLive ? 'border-green-500' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${isLive ? 'bg-green-500/10' : 'bg-muted'}`}>
              <Video className={`h-6 w-6 ${isLive ? 'text-green-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">Video Consultation</p>
                <Badge variant={isLive ? 'default' : room.status === 'scheduled' ? 'secondary' : 'outline'}>
                  {isLive ? 'Live' : room.status}
                </Badge>
                {room.is_group_call && (
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    Group
                  </Badge>
                )}
                {room.recording_enabled && (
                  <Badge variant="outline" className="text-destructive">
                    Recording
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(scheduledDate, 'MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(scheduledDate, 'h:mm a')}
                </span>
                {room.actual_end && (
                  <span>
                    Duration: {Math.round((new Date(room.actual_end).getTime() - new Date(room.actual_start!).getTime()) / 60000)} min
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isPast && onJoin && (
              <Button onClick={onJoin} variant={isLive ? 'default' : 'outline'}>
                <MonitorPlay className="h-4 w-4 mr-2" />
                {isLive ? 'Join Now' : 'Start Call'}
              </Button>
            )}
            {isPast && room.recording_url && (
              <Button variant="outline" size="sm">
                <MonitorPlay className="h-4 w-4 mr-2" />
                View Recording
              </Button>
            )}
            {isPast && (
              <Button variant="ghost" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Notes
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Create Room Dialog Component
function CreateRoomDialog({ 
  patients, 
  onSubmit, 
  isLoading 
}: { 
  patients: any[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [patientId, setPatientId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isGroupCall, setIsGroupCall] = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  const handleSubmit = () => {
    if (!patientId || !scheduledDate || !scheduledTime) return;
    
    const scheduledStart = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    onSubmit({
      patientUserId: patientId,
      scheduledStart,
      isGroupCall,
      recordingEnabled,
    });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Schedule Video Call</DialogTitle>
        <DialogDescription>
          Create a new video consultation with a patient
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>Select Patient</Label>
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a patient" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((assignment: any) => (
                <SelectItem key={assignment.patient_user_id} value={assignment.patient_user_id}>
                  {assignment.patient?.first_name} {assignment.patient?.last_name} ({assignment.patient?.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input 
              type="date" 
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="space-y-2">
            <Label>Time</Label>
            <Input 
              type="time" 
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Group Call</Label>
            <p className="text-xs text-muted-foreground">Allow multiple participants</p>
          </div>
          <Switch checked={isGroupCall} onCheckedChange={setIsGroupCall} />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable Recording</Label>
            <p className="text-xs text-muted-foreground">Record the consultation</p>
          </div>
          <Switch checked={recordingEnabled} onCheckedChange={setRecordingEnabled} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => {}}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          disabled={!patientId || !scheduledDate || !scheduledTime || isLoading}
        >
          {isLoading ? 'Creating...' : 'Schedule Call'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default TelemedicinePage;
