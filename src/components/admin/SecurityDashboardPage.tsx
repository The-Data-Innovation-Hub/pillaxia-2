import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  AlertTriangle,
  Lock,
  Activity,
  Users,
  FileText,
  Clock,
  Download,
  RefreshCw,
  Eye,
  ShieldAlert,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format, subDays } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type SecurityEventType = Database["public"]["Enums"]["security_event_type"];

interface SecurityEvent {
  id: string;
  user_id: string | null;
  event_type: SecurityEventType;
  event_category: string;
  severity: string;
  description: string | null;
  ip_address: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface DataAccessLog {
  id: string;
  user_id: string;
  accessed_table: string;
  access_type: string;
  data_category: string;
  patient_id: string | null;
  created_at: string;
}

interface ActiveSession {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  last_activity_at: string;
  created_at: string;
  is_active: boolean;
}

export function SecurityDashboardPage() {
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("7");

  // Fetch security events
  const { data: securityEvents, isLoading: loadingEvents, refetch: refetchEvents } = useQuery({
    queryKey: ["security-events", eventFilter, severityFilter, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("security_events")
        .select("*")
        .gte("created_at", subDays(new Date(), parseInt(dateRange)).toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (eventFilter !== "all" && eventFilter) {
        query = query.eq("event_type", eventFilter as SecurityEventType);
      }
      if (severityFilter !== "all") {
        query = query.eq("severity", severityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SecurityEvent[];
    },
  });

  // Fetch data access logs
  const { data: dataAccessLogs, isLoading: loadingAccess } = useQuery({
    queryKey: ["data-access-logs", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_access_log")
        .select("*")
        .gte("created_at", subDays(new Date(), parseInt(dateRange)).toISOString())
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as DataAccessLog[];
    },
  });

  // Fetch active sessions
  const { data: activeSessions, isLoading: loadingSessions, refetch: refetchSessions } = useQuery({
    queryKey: ["active-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("last_activity_at", { ascending: false });

      if (error) throw error;
      return data as ActiveSession[];
    },
  });

  // Calculate stats
  const stats = {
    totalEvents: securityEvents?.length || 0,
    criticalEvents: securityEvents?.filter((e) => e.severity === "critical").length || 0,
    warningEvents: securityEvents?.filter((e) => e.severity === "warning").length || 0,
    activeSessions: activeSessions?.length || 0,
    failedLogins: securityEvents?.filter((e) => e.event_type === "login_failure").length || 0,
    phiAccess: dataAccessLogs?.filter((l) => l.data_category === "phi").length || 0,
  };

  const getSeverityBadge = (severity: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      info: { variant: "secondary", className: "" },
      warning: { variant: "outline", className: "border-yellow-500 text-yellow-600" },
      critical: { variant: "destructive", className: "" },
    };
    const { variant, className } = config[severity] || config.info;
    return (
      <Badge variant={variant} className={className}>
        {severity}
      </Badge>
    );
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "login_success":
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "login_failure":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "logout":
        return <Lock className="h-4 w-4 text-muted-foreground" />;
      case "session_timeout":
        return <Clock className="h-4 w-4 text-accent-foreground" />;
      case "suspicious_activity":
        return <ShieldAlert className="h-4 w-4 text-destructive" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Security Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor security events, sessions, and compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Last 24 hours</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetchEvents()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground">
              Last {dateRange} days
            </p>
          </CardContent>
        </Card>

        <Card className={stats.criticalEvents > 0 ? "border-destructive" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.criticalEvents}</div>
            <p className="text-xs text-muted-foreground">
              {stats.warningEvents} warnings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeSessions}</div>
            <p className="text-xs text-muted-foreground">
              Currently online
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PHI Access</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.phiAccess}</div>
            <p className="text-xs text-muted-foreground">
              Protected health info accessed
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="access">Data Access Log</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Security Events</CardTitle>
                  <CardDescription>Real-time security event monitoring</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={eventFilter} onValueChange={setEventFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      <SelectItem value="login_success">Login Success</SelectItem>
                      <SelectItem value="login_failure">Login Failure</SelectItem>
                      <SelectItem value="logout">Logout</SelectItem>
                      <SelectItem value="session_timeout">Session Timeout</SelectItem>
                      <SelectItem value="suspicious_activity">Suspicious Activity</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severity</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !securityEvents?.length ? (
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No security events found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {securityEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="flex items-center gap-2">
                          {getEventIcon(event.event_type)}
                          <span className="font-medium">
                            {event.event_type.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.event_category}</Badge>
                        </TableCell>
                        <TableCell>{getSeverityBadge(event.severity)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {event.ip_address || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(event.created_at), "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>Currently active user sessions</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchSessions()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !activeSessions?.length ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No active sessions</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead>Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-mono text-xs">
                          {session.user_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {session.ip_address || "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {session.user_agent?.split(" ")[0] || "Unknown"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(session.last_activity_at), "HH:mm:ss")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(session.created_at), "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Data Access Log</CardTitle>
                  <CardDescription>HIPAA/NDPR compliance audit trail</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingAccess ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !dataAccessLogs?.length ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No data access logs</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Table</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataAccessLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {log.user_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {log.accessed_table}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.access_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={log.data_category === "phi" ? "destructive" : "secondary"}
                          >
                            {log.data_category}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM d, HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
