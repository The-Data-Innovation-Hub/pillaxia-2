import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { 
  FileText, 
  Download, 
  Calendar as CalendarIcon, 
  Shield, 
  ClipboardCheck, 
  AlertTriangle,
  FileCheck,
  Loader2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

type ReportType = "security_summary" | "data_access" | "hipaa_audit" | "user_activity";

interface ReportSummary {
  total_events: number;
  critical_events: number;
  warning_events: number;
  unique_users: number;
  date_range: string;
}

export function ComplianceReportPage() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [reportType, setReportType] = useState<ReportType>("security_summary");

  // Fetch existing reports
  const { data: existingReports, isLoading: reportsLoading, refetch } = useQuery({
    queryKey: ["compliance-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compliance_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  // Generate report mutation
  const generateReport = useMutation({
    mutationFn: async () => {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      // Fetch data based on report type
      let reportData: Record<string, unknown> = {};
      let summary: ReportSummary = {
        total_events: 0,
        critical_events: 0,
        warning_events: 0,
        unique_users: 0,
        date_range: `${startStr} to ${endStr}`,
      };

      if (reportType === "security_summary" || reportType === "hipaa_audit") {
        const { data: securityEvents, error: secError } = await supabase
          .from("security_events")
          .select("*")
          .gte("created_at", startStr)
          .lte("created_at", endStr + "T23:59:59");

        if (secError) throw secError;

        reportData.security_events = securityEvents;
        summary.total_events = securityEvents?.length || 0;
        summary.critical_events = securityEvents?.filter(e => e.severity === 'critical').length || 0;
        summary.warning_events = securityEvents?.filter(e => e.severity === 'warning').length || 0;
        summary.unique_users = new Set(securityEvents?.map(e => e.user_id)).size;

        // Get account lockouts
        const { data: lockouts } = await supabase
          .from("account_lockouts")
          .select("*")
          .gte("created_at", startStr)
          .lte("created_at", endStr + "T23:59:59");

        reportData.account_lockouts = lockouts;
      }

      if (reportType === "data_access" || reportType === "hipaa_audit") {
        const { data: accessLogs, error: accessError } = await supabase
          .from("data_access_log")
          .select("*")
          .gte("created_at", startStr)
          .lte("created_at", endStr + "T23:59:59");

        if (accessError) throw accessError;

        reportData.data_access_logs = accessLogs;
        if (reportType === "data_access") {
          summary.total_events = accessLogs?.length || 0;
          summary.unique_users = new Set(accessLogs?.map(e => e.user_id)).size;
        }
      }

      if (reportType === "user_activity") {
        const { data: auditLogs, error: auditError } = await supabase
          .from("audit_log")
          .select("*")
          .gte("created_at", startStr)
          .lte("created_at", endStr + "T23:59:59");

        if (auditError) throw auditError;

        reportData.audit_logs = auditLogs;
        summary.total_events = auditLogs?.length || 0;
        summary.unique_users = new Set(auditLogs?.map(e => e.user_id)).size;
      }

      // Save report to database
      const { data: savedReport, error: saveError } = await supabase
        .from("compliance_reports")
        .insert({
          report_type: reportType,
          report_period_start: startStr,
          report_period_end: endStr,
          generated_by: user?.id || '',
          report_data: reportData,
          summary: summary,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      return savedReport;
    },
    onSuccess: () => {
      toast.success("Compliance report generated successfully");
      refetch();
    },
    onError: (error: unknown) => {
      console.error("Failed to generate report:", error);
      toast.error("Failed to generate report");
    },
  });

  // Download report as JSON
  const downloadReport = (report: {
    report_data: unknown;
    report_type: string;
    report_period_start: string;
    report_period_end: string;
  }) => {
    const dataStr = JSON.stringify(report.report_data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.report_type}_${report.report_period_start}_${report.report_period_end}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download report as CSV
  const downloadReportCSV = (report: { report_data: { security_events?: Record<string, unknown>[]; data_access_logs?: Record<string, unknown>[]; audit_logs?: Record<string, unknown>[]; }; report_type: string; report_period_start: string; report_period_end: string; }): void => {
    let csvContent = "";
    const data = report.report_data;

    // Determine which data to export based on report type
    let rows: Record<string, unknown>[] = [];
    let headers: string[] = [];

    if (data.security_events?.length) {
      rows = data.security_events;
      headers = ["id", "created_at", "user_id", "event_type", "event_category", "severity", "description", "ip_address"];
    } else if (data.data_access_logs?.length) {
      rows = data.data_access_logs;
      headers = ["id", "created_at", "user_id", "accessed_table", "access_type", "data_category", "ip_address"];
    } else if (data.audit_logs?.length) {
      rows = data.audit_logs;
      headers = ["id", "created_at", "user_id", "action", "target_table", "target_id"];
    }

    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }

    // Create CSV
    csvContent = headers.join(",") + "\n";
    rows.forEach(row => {
      csvContent += headers.map(h => {
        const val = row[h];
        if (typeof val === "object") return JSON.stringify(val).replace(/,/g, ";");
        return String(val ?? "").replace(/,/g, ";");
      }).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.report_type}_${report.report_period_start}_${report.report_period_end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getReportTypeIcon = (type: string) => {
    switch (type) {
      case "security_summary": return <Shield className="h-4 w-4" />;
      case "data_access": return <Eye className="h-4 w-4" />;
      case "hipaa_audit": return <ClipboardCheck className="h-4 w-4" />;
      case "user_activity": return <FileCheck className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getReportTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      security_summary: "Security Summary",
      data_access: "Data Access",
      hipaa_audit: "HIPAA/NDPR Audit",
      user_activity: "User Activity",
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" />
          Compliance Reports
        </h1>
        <p className="text-muted-foreground">
          Generate and download security compliance reports for HIPAA/NDPR audits
        </p>
      </div>

      {/* Report Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate New Report
          </CardTitle>
          <CardDescription>
            Select a report type and date range to generate a compliance report
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {/* Report Type */}
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="security_summary">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Security Summary
                    </div>
                  </SelectItem>
                  <SelectItem value="data_access">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Data Access Log
                    </div>
                  </SelectItem>
                  <SelectItem value="hipaa_audit">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      HIPAA/NDPR Full Audit
                    </div>
                  </SelectItem>
                  <SelectItem value="user_activity">
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      User Activity
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => d && setEndDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Generate Button */}
            <div className="space-y-2">
              <Label className="invisible">Generate</Label>
              <Button 
                onClick={() => generateReport.mutate()}
                disabled={generateReport.isPending}
                className="w-full"
              >
                {generateReport.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate Report
              </Button>
            </div>
          </div>

          {/* Quick Date Range Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(subDays(new Date(), 7));
                setEndDate(new Date());
              }}
            >
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(subDays(new Date(), 30));
                setEndDate(new Date());
              }}
            >
              Last 30 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(startOfMonth(new Date()));
                setEndDate(endOfMonth(new Date()));
              }}
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const lastMonth = subDays(startOfMonth(new Date()), 1);
                setStartDate(startOfMonth(lastMonth));
                setEndDate(endOfMonth(lastMonth));
              }}
            >
              Last Month
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Previous Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>
            Previously generated compliance reports available for download
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !existingReports?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No reports generated yet</p>
              <p className="text-sm">Generate your first compliance report above</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {existingReports.map((report) => {
                  const summary = report.summary as unknown as ReportSummary | null;
                  return (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getReportTypeIcon(report.report_type)}
                          <Badge variant="outline">
                            {getReportTypeBadge(report.report_type)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(report.report_period_start), "MMM d, yyyy")} -{" "}
                        {format(new Date(report.report_period_end), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="secondary">
                            {summary?.total_events || 0} events
                          </Badge>
                          {(summary?.critical_events || 0) > 0 && (
                            <Badge variant="destructive">
                              {summary?.critical_events} critical
                            </Badge>
                          )}
                          {(summary?.warning_events || 0) > 0 && (
                            <Badge variant="outline" className="border-amber-500 text-amber-700">
                              {summary?.warning_events} warnings
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(report.created_at), "PPp")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadReport(report)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            JSON
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadReportCSV(report)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            CSV
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
