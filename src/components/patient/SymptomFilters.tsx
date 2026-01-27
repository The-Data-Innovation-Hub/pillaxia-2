import { useState, useMemo } from "react";
import { format } from "date-fns";
import { CalendarIcon, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CachedSymptomEntry } from "@/lib/cache";

export interface SymptomFilters {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  symptomType: string | undefined;
  severityRange: [number, number];
  medicationId: string | undefined;
}

interface SymptomFiltersProps {
  symptoms: CachedSymptomEntry[];
  filters: SymptomFilters;
  onFiltersChange: (filters: SymptomFilters) => void;
}

const SYMPTOM_TYPES = [
  "Headache",
  "Nausea",
  "Fatigue",
  "Dizziness",
  "Pain",
  "Stomach Issues",
  "Anxiety",
  "Sleep Issues",
  "Muscle Pain",
  "Heartburn",
  "Insomnia",
  "Other",
];

export const DEFAULT_FILTERS: SymptomFilters = {
  dateFrom: undefined,
  dateTo: undefined,
  symptomType: undefined,
  severityRange: [1, 10],
  medicationId: undefined,
};

export function SymptomFiltersPanel({
  symptoms,
  filters,
  onFiltersChange,
}: SymptomFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract unique medications from symptoms
  const medications = useMemo(() => {
    const medMap = new Map<string, string>();
    symptoms.forEach((s) => {
      if (s.medication_id && s.medications?.name) {
        medMap.set(s.medication_id, s.medications.name);
      }
    });
    return Array.from(medMap.entries()).map(([id, name]) => ({ id, name }));
  }, [symptoms]);

  // Extract unique symptom types from actual data
  const symptomTypes = useMemo(() => {
    const types = new Set<string>();
    symptoms.forEach((s) => types.add(s.symptom_type));
    return Array.from(types).sort();
  }, [symptoms]);

  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    filters.symptomType ||
    filters.medicationId ||
    filters.severityRange[0] !== 1 ||
    filters.severityRange[1] !== 10;

  const activeFilterCount = [
    filters.dateFrom || filters.dateTo,
    filters.symptomType,
    filters.medicationId,
    filters.severityRange[0] !== 1 || filters.severityRange[1] !== 10,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange(DEFAULT_FILTERS);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant={isExpanded ? "default" : "outline"}
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg border bg-card">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !filters.dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateFrom ? format(filters.dateFrom, "MMM d") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) =>
                      onFiltersChange({ ...filters, dateFrom: date })
                    }
                    disabled={(date) =>
                      date > new Date() || (filters.dateTo ? date > filters.dateTo : false)
                    }
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !filters.dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateTo ? format(filters.dateTo, "MMM d") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) =>
                      onFiltersChange({ ...filters, dateTo: date })
                    }
                    disabled={(date) =>
                      date > new Date() || (filters.dateFrom ? date < filters.dateFrom : false)
                    }
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Symptom Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Symptom Type</label>
            <Select
              value={filters.symptomType || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  symptomType: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all">All types</SelectItem>
                {symptomTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Severity: {filters.severityRange[0]} - {filters.severityRange[1]}
            </label>
            <Slider
              value={filters.severityRange}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  severityRange: value as [number, number],
                })
              }
              min={1}
              max={10}
              step={1}
              className="py-2"
            />
          </div>

          {/* Medication */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Medication</label>
            <Select
              value={filters.medicationId || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  medicationId: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All medications" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                <SelectItem value="all">All medications</SelectItem>
                <SelectItem value="none">No medication linked</SelectItem>
                {medications.map((med) => (
                  <SelectItem key={med.id} value={med.id}>
                    {med.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

export function applySymptomFilters(
  symptoms: CachedSymptomEntry[],
  filters: SymptomFilters
): CachedSymptomEntry[] {
  return symptoms.filter((symptom) => {
    const recordedAt = new Date(symptom.recorded_at);

    // Date range filter
    if (filters.dateFrom && recordedAt < filters.dateFrom) return false;
    if (filters.dateTo) {
      const endOfDay = new Date(filters.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (recordedAt > endOfDay) return false;
    }

    // Symptom type filter
    if (filters.symptomType && symptom.symptom_type !== filters.symptomType) {
      return false;
    }

    // Severity range filter
    if (
      symptom.severity < filters.severityRange[0] ||
      symptom.severity > filters.severityRange[1]
    ) {
      return false;
    }

    // Medication filter
    if (filters.medicationId === "none" && symptom.medication_id !== null) {
      return false;
    }
    if (
      filters.medicationId &&
      filters.medicationId !== "none" &&
      symptom.medication_id !== filters.medicationId
    ) {
      return false;
    }

    return true;
  });
}
