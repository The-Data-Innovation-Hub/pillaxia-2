import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { CachedSymptomEntry } from "@/lib/cache";

interface SymptomCalendarProps {
  symptoms: CachedSymptomEntry[];
}

interface DayData {
  date: Date;
  symptoms: CachedSymptomEntry[];
  maxSeverity: number;
  avgSeverity: number;
}

const getSeverityColor = (severity: number): string => {
  if (severity === 0) return "";
  if (severity <= 3) return "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-400";
  if (severity <= 6) return "bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-400";
  return "bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-400";
};

const getSeverityDotColor = (severity: number): string => {
  if (severity <= 3) return "bg-green-500";
  if (severity <= 6) return "bg-amber-500";
  return "bg-red-500";
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SymptomCalendar({ symptoms }: SymptomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Build a map of dates to symptoms
  const symptomsByDate = useMemo(() => {
    const map = new Map<string, CachedSymptomEntry[]>();
    symptoms.forEach((s) => {
      const dateKey = format(new Date(s.recorded_at), "yyyy-MM-dd");
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(s);
    });
    return map;
  }, [symptoms]);

  // Generate calendar days for the current month view
  const calendarDays = useMemo<DayData[]>(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return days.map((date) => {
      const dateKey = format(date, "yyyy-MM-dd");
      const daySymptoms = symptomsByDate.get(dateKey) || [];
      const severities = daySymptoms.map((s) => s.severity);

      return {
        date,
        symptoms: daySymptoms,
        maxSeverity: severities.length > 0 ? Math.max(...severities) : 0,
        avgSeverity:
          severities.length > 0
            ? severities.reduce((a, b) => a + b, 0) / severities.length
            : 0,
      };
    });
  }, [currentMonth, symptomsByDate]);

  // Get selected day's symptoms
  const selectedDaySymptoms = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return symptomsByDate.get(dateKey) || [];
  }, [selectedDate, symptomsByDate]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      {/* Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarIcon className="h-5 w-5" />
              {format(currentMonth, "MMMM yyyy")}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const isCurrentMonth = isSameMonth(day.date, currentMonth);
              const isSelected = selectedDate && isSameDay(day.date, selectedDate);
              const hasSymptoms = day.symptoms.length > 0;

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(day.date)}
                  className={cn(
                    "relative aspect-square p-1 rounded-md text-sm transition-all",
                    "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                    !isCurrentMonth && "text-muted-foreground/40",
                    isToday(day.date) && "ring-1 ring-primary",
                    isSelected && "ring-2 ring-primary bg-accent",
                    hasSymptoms && isCurrentMonth && getSeverityColor(day.maxSeverity)
                  )}
                >
                  <span className={cn(
                    "block",
                    isToday(day.date) && "font-bold"
                  )}>
                    {format(day.date, "d")}
                  </span>
                  
                  {/* Symptom count indicator */}
                  {hasSymptoms && isCurrentMonth && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {day.symptoms.length <= 3 ? (
                        day.symptoms.map((s, i) => (
                          <span
                            key={i}
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              getSeverityDotColor(s.severity)
                            )}
                          />
                        ))
                      ) : (
                        <>
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              getSeverityDotColor(day.maxSeverity)
                            )}
                          />
                          <span className="text-[8px] leading-none">
                            +{day.symptoms.length - 1}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-green-500/30 border border-green-500/50" />
              <span>Mild (1-3)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-amber-500/30 border border-amber-500/50" />
              <span>Moderate (4-6)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-red-500/30 border border-red-500/50" />
              <span>Severe (7-10)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Details Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {selectedDate
                ? format(selectedDate, "EEEE, MMM d")
                : "Select a day"}
            </CardTitle>
            {selectedDate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setSelectedDate(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Click on a date to view symptoms
            </p>
          ) : selectedDaySymptoms.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">✨</div>
              <p className="text-sm text-muted-foreground">
                No symptoms logged
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-3">
              <div className="space-y-3">
                {selectedDaySymptoms
                  .sort(
                    (a, b) =>
                      new Date(b.recorded_at).getTime() -
                      new Date(a.recorded_at).getTime()
                  )
                  .map((symptom) => (
                    <div
                      key={symptom.id}
                      className="p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {symptom.symptom_type}
                        </span>
                        <Badge
                          variant={
                            symptom.severity <= 3
                              ? "secondary"
                              : symptom.severity <= 6
                              ? "default"
                              : "destructive"
                          }
                          className="text-xs shrink-0"
                        >
                          {symptom.severity}/10
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mb-1">
                        {format(new Date(symptom.recorded_at), "h:mm a")}
                      </p>
                      
                      {symptom.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {symptom.description}
                        </p>
                      )}
                      
                      {symptom.medications && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          {symptom.medications.name}
                        </Badge>
                      )}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
