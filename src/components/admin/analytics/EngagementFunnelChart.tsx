import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Send, CheckCircle, Eye, MousePointer } from "lucide-react";

interface EngagementFunnelChartProps {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  isLoading: boolean;
}

export function EngagementFunnelChart({
  sent,
  delivered,
  opened,
  clicked,
  isLoading,
}: EngagementFunnelChartProps) {
  const stages = [
    {
      label: "Sent",
      value: sent,
      icon: Send,
      color: "bg-blue-500",
      textColor: "text-blue-600",
    },
    {
      label: "Delivered",
      value: delivered,
      icon: CheckCircle,
      color: "bg-green-500",
      textColor: "text-green-600",
    },
    {
      label: "Opened",
      value: opened,
      icon: Eye,
      color: "bg-purple-500",
      textColor: "text-purple-600",
    },
    {
      label: "Clicked",
      value: clicked,
      icon: MousePointer,
      color: "bg-amber-500",
      textColor: "text-amber-600",
    },
  ];

  const maxValue = sent || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Engagement Funnel
        </CardTitle>
        <CardDescription>
          Track notification journey from sent to clicked
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {stages.map((stage, index) => {
              const percentage = (stage.value / maxValue) * 100;
              const Icon = stage.icon;
              const dropOff = index > 0 
                ? stages[index - 1].value - stage.value 
                : 0;
              const dropOffPercent = index > 0 && stages[index - 1].value > 0
                ? ((dropOff / stages[index - 1].value) * 100).toFixed(1)
                : "0";

              return (
                <div key={stage.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${stage.textColor}`} />
                      <span className="font-medium">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold">{stage.value.toLocaleString()}</span>
                      {index > 0 && dropOff > 0 && (
                        <span className="text-xs text-muted-foreground">
                          -{dropOff.toLocaleString()} ({dropOffPercent}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={percentage} 
                      className="h-8" 
                    />
                    <div 
                      className={`absolute inset-y-0 left-0 ${stage.color} rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
