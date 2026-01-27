import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ChannelStat {
  channel: string;
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  deliveryRate: string;
  openRate: string;
  clickRate: string;
}

interface TrendDataPoint {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
}

interface AnalyticsExportProps {
  channelStats: ChannelStat[];
  trendData: TrendDataPoint[];
  totalNotifications: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalFailed: number;
  timeRange: string;
}

export function AnalyticsExport({
  channelStats,
  trendData,
  totalNotifications,
  totalSent,
  totalDelivered,
  totalOpened,
  totalClicked,
  totalFailed,
  timeRange,
}: AnalyticsExportProps) {
  const [isExporting, setIsExporting] = useState(false);

  const generateCSV = (): string => {
    const lines: string[] = [];
    
    // Summary section
    lines.push("Notification Analytics Report");
    lines.push(`Generated: ${format(new Date(), "PPpp")}`);
    lines.push(`Time Range: Last ${timeRange}`);
    lines.push("");
    
    // Overview stats
    lines.push("OVERVIEW");
    lines.push("Metric,Value");
    lines.push(`Total Notifications,${totalNotifications}`);
    lines.push(`Successfully Sent,${totalSent}`);
    lines.push(`Delivered,${totalDelivered}`);
    lines.push(`Opened,${totalOpened}`);
    lines.push(`Clicked,${totalClicked}`);
    lines.push(`Failed,${totalFailed}`);
    lines.push("");
    
    // Channel breakdown
    lines.push("CHANNEL BREAKDOWN");
    lines.push("Channel,Total,Sent,Delivered,Opened,Clicked,Failed,Delivery Rate,Open Rate,Click Rate");
    channelStats.forEach(stat => {
      lines.push(
        `${stat.channel},${stat.total},${stat.sent},${stat.delivered},${stat.opened},${stat.clicked},${stat.failed},${stat.deliveryRate}%,${stat.openRate}%,${stat.clickRate}%`
      );
    });
    lines.push("");
    
    // Daily trend
    lines.push("DAILY TREND");
    lines.push("Date,Sent,Delivered,Opened,Clicked,Failed");
    trendData.forEach(day => {
      lines.push(
        `${day.date},${day.sent},${day.delivered},${day.opened},${day.clicked},${day.failed}`
      );
    });
    
    return lines.join("\n");
  };

  const downloadCSV = () => {
    setIsExporting(true);
    try {
      const csv = generateCSV();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `notification-analytics-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export CSV");
    } finally {
      setIsExporting(false);
    }
  };

  const downloadPDF = async () => {
    setIsExporting(true);
    try {
      // Generate a printable HTML report
      const reportHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Notification Analytics Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #1a365d; border-bottom: 2px solid #22d3ee; padding-bottom: 10px; }
            h2 { color: #374151; margin-top: 30px; }
            .meta { color: #6b7280; font-size: 14px; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: left; }
            th { background: #f3f4f6; font-weight: 600; }
            tr:nth-child(even) { background: #f9fafb; }
            .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
            .stat-card { background: #f9fafb; padding: 16px; border-radius: 8px; text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #1a365d; }
            .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <h1>📊 Notification Analytics Report</h1>
          <p class="meta">Generated: ${format(new Date(), "PPpp")} | Time Range: Last ${timeRange}</p>
          
          <h2>Overview</h2>
          <div class="stat-grid">
            <div class="stat-card">
              <div class="stat-value">${totalNotifications}</div>
              <div class="stat-label">Total Notifications</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalSent}</div>
              <div class="stat-label">Successfully Sent</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalDelivered}</div>
              <div class="stat-label">Delivered</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalOpened}</div>
              <div class="stat-label">Opened</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalClicked}</div>
              <div class="stat-label">Clicked</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${totalFailed}</div>
              <div class="stat-label">Failed</div>
            </div>
          </div>
          
          <h2>Channel Breakdown</h2>
          <table>
            <thead>
              <tr>
                <th>Channel</th>
                <th>Total</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Opened</th>
                <th>Clicked</th>
                <th>Failed</th>
                <th>Delivery %</th>
                <th>Open %</th>
                <th>Click %</th>
              </tr>
            </thead>
            <tbody>
              ${channelStats.map(stat => `
                <tr>
                  <td style="text-transform: capitalize;">${stat.channel}</td>
                  <td>${stat.total}</td>
                  <td>${stat.sent}</td>
                  <td>${stat.delivered}</td>
                  <td>${stat.opened}</td>
                  <td>${stat.clicked}</td>
                  <td>${stat.failed}</td>
                  <td>${stat.deliveryRate}%</td>
                  <td>${stat.openRate}%</td>
                  <td>${stat.clickRate}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          
          <h2>Daily Trend</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Sent</th>
                <th>Delivered</th>
                <th>Opened</th>
                <th>Clicked</th>
                <th>Failed</th>
              </tr>
            </thead>
            <tbody>
              ${trendData.map(day => `
                <tr>
                  <td>${day.date}</td>
                  <td>${day.sent}</td>
                  <td>${day.delivered}</td>
                  <td>${day.opened}</td>
                  <td>${day.clicked}</td>
                  <td>${day.failed}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          
          <p style="margin-top: 40px; color: #6b7280; font-size: 12px; text-align: center;">
            © ${new Date().getFullYear()} Pillaxia - Medication Adherence Platform
          </p>
        </body>
        </html>
      `;
      
      // Open in new window for printing
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(reportHtml);
        printWindow.document.close();
        printWindow.print();
        toast.success("PDF report opened for printing");
      } else {
        toast.error("Please allow popups to generate PDF");
      }
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={downloadCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadPDF}>
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
