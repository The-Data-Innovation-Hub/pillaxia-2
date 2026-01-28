import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCircle, XCircle, TrendingUp, Eye, MousePointer, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface OverviewCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  subtitle?: string;
}

interface AnalyticsOverviewCardsProps {
  totalNotifications: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalFailed: number;
  overallSuccessRate: string;
  deliveryRate: string;
  openRate: string;
  clickRate: string;
  isLoading: boolean;
}

function OverviewCard({ title, value, icon: Icon, color, bgColor, subtitle }: OverviewCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsOverviewCards({
  totalNotifications,
  totalSent,
  totalDelivered,
  totalOpened,
  totalClicked,
  totalFailed,
  overallSuccessRate,
  deliveryRate,
  openRate,
  clickRate,
  isLoading,
}: AnalyticsOverviewCardsProps) {
  const cards: OverviewCardProps[] = [
    {
      title: "Total Notifications",
      value: totalNotifications,
      icon: Bell,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Successfully Sent",
      value: totalSent,
      icon: Send,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      subtitle: `${overallSuccessRate}% success rate`,
    },
    {
      title: "Delivered",
      value: totalDelivered,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      subtitle: `${deliveryRate}% of sent`,
    },
    {
      title: "Opened",
      value: totalOpened,
      icon: Eye,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      subtitle: `${openRate}% open rate`,
    },
    {
      title: "Clicked",
      value: totalClicked,
      icon: MousePointer,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      subtitle: `${clickRate}% click rate`,
    },
    {
      title: "Failed",
      value: totalFailed,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-7 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => (
        <OverviewCard key={card.title} {...card} />
      ))}
    </div>
  );
}
