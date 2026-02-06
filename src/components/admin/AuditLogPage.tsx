import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, FileText, Eye, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  };
}

export function AuditLogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data: auditLogs, error } = await db
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set(auditLogs?.map((l) => l.user_id).filter(Boolean))] as string[];

      // Fetch profiles for users
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      // Map logs with user info
      const logsWithUsers: AuditLogEntry[] = (auditLogs || []).map((log) => {
        const profile = profiles?.find((p) => p.user_id === log.user_id);
        return {
          ...log,
          user: profile
            ? {
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email,
              }
            : undefined,
        };
      });

      return logsWithUsers;
    },
  });

  const filteredLogs = logs?.filter((log) => {
    const matchesSearch =
      searchQuery === "" ||
      log.target_table?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${log.user?.first_name || ""} ${log.user?.last_name || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      log.user?.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction =
      actionFilter === "all" || log.action.toLowerCase() === actionFilter.toLowerCase();

    return matchesSearch && matchesAction;
  });

  const getActionIcon = (action: string) => {
    switch (action.toUpperCase()) {
      case "INSERT":
        return <Plus className="h-3 w-3" />;
      case "UPDATE":
        return <Pencil className="h-3 w-3" />;
      case "DELETE":
        return <Trash2 className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const getActionBadge = (action: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
      INSERT: { variant: "default", className: "bg-green-100 text-green-700 hover:bg-green-100" },
      UPDATE: { variant: "secondary", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
      DELETE: { variant: "destructive", className: "" },
    };

    const { variant, className } = config[action.toUpperCase()] || {
      variant: "outline" as const,
      className: "",
    };

    return (
      <Badge variant={variant} className={`gap-1 ${className}`}>
        {getActionIcon(action)}
        {action}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Track all system activities and changes</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Recent Activity</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="INSERT">Insert</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !filteredLogs?.length ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? "No logs match your search" : "No audit logs recorded yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell>
                        {log.user ? (
                          <div>
                            <p className="font-medium text-sm">
                              {log.user.first_name} {log.user.last_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {log.user.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">System</span>
                        )}
                      </TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {log.target_table || "—"}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                  <p>{format(new Date(selectedLog.created_at), "PPpp")}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action</p>
                  {getActionBadge(selectedLog.action)}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User</p>
                  <p>
                    {selectedLog.user
                      ? `${selectedLog.user.first_name} ${selectedLog.user.last_name}`
                      : "System"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Table</p>
                  <code className="text-sm bg-muted px-2 py-1 rounded">
                    {selectedLog.target_table || "—"}
                  </code>
                </div>
                {selectedLog.target_id && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Target ID</p>
                    <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                      {selectedLog.target_id}
                    </code>
                  </div>
                )}
                {selectedLog.ip_address && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">IP Address</p>
                    <p>{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>

              {selectedLog.details && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Change Details
                  </p>
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.user_agent && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    User Agent
                  </p>
                  <p className="text-xs text-muted-foreground break-all">
                    {selectedLog.user_agent}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
