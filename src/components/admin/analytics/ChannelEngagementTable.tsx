import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bell, Mail, MessageSquare, Smartphone, Phone } from "lucide-react";

interface ChannelStats {
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

interface ChannelEngagementTableProps {
  channelStats: ChannelStats[];
  isLoading: boolean;
}

const CHANNEL_ICONS: Record<string, typeof Bell> = {
  push: Smartphone,
  email: Mail,
  whatsapp: MessageSquare,
  sms: Phone,
};

const CHANNEL_COLORS: Record<string, string> = {
  push: "#8B5CF6",
  email: "#3B82F6",
  whatsapp: "#22C55E",
  sms: "#F59E0B",
};

function getRateBadge(rate: string, type: 'delivery' | 'open' | 'click') {
  const value = parseFloat(rate);
  
  const thresholds = {
    delivery: { good: 90, warn: 70 },
    open: { good: 30, warn: 15 },
    click: { good: 5, warn: 2 },
  };
  
  const t = thresholds[type];
  
  if (value >= t.good) {
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{rate}%</Badge>;
  } else if (value >= t.warn) {
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{rate}%</Badge>;
  }
  return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{rate}%</Badge>;
}

export function ChannelEngagementTable({
  channelStats,
  isLoading,
}: ChannelEngagementTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Channel Engagement Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = channelStats.some(c => c.total > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel Engagement Breakdown</CardTitle>
        <CardDescription>
          Detailed delivery and engagement metrics by notification channel
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Opened</TableHead>
                <TableHead className="text-right">Clicked</TableHead>
                <TableHead className="text-right">Delivery Rate</TableHead>
                <TableHead className="text-right">Open Rate</TableHead>
                <TableHead className="text-right">Click Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channelStats.map((channel) => {
                const Icon = CHANNEL_ICONS[channel.channel] || Bell;
                return (
                  <TableRow key={channel.channel}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Icon 
                          className="h-4 w-4" 
                          style={{ color: CHANNEL_COLORS[channel.channel] }}
                        />
                        <span className="font-medium capitalize">{channel.channel}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {channel.total.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {channel.sent.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {channel.delivered.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {channel.opened.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {channel.clicked.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {getRateBadge(channel.deliveryRate, 'delivery')}
                    </TableCell>
                    <TableCell className="text-right">
                      {getRateBadge(channel.openRate, 'open')}
                    </TableCell>
                    <TableCell className="text-right">
                      {getRateBadge(channel.clickRate, 'click')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            No notification data in this period
          </div>
        )}
      </CardContent>
    </Card>
  );
}
