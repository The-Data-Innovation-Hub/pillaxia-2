import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp, Pill, Activity } from "lucide-react";
import type { CachedSymptomEntry } from "@/lib/cache";

interface SymptomCorrelationsProps {
  symptoms: CachedSymptomEntry[];
}

interface MedicationCorrelation {
  medicationId: string;
  medicationName: string;
  symptomBreakdown: {
    symptomType: string;
    count: number;
    avgSeverity: number;
    percentage: number;
  }[];
  totalSymptoms: number;
  avgSeverity: number;
}

interface SymptomPattern {
  symptomType: string;
  totalCount: number;
  linkedToMedication: number;
  unlinkedCount: number;
  avgSeverityWithMed: number;
  avgSeverityWithoutMed: number;
  topMedications: { name: string; count: number; avgSeverity: number }[];
}

const getSeverityLevel = (severity: number): { label: string; color: string } => {
  if (severity <= 3) return { label: "Mild", color: "text-green-600" };
  if (severity <= 6) return { label: "Moderate", color: "text-yellow-600" };
  return { label: "Severe", color: "text-red-600" };
};

const getSeverityBadgeVariant = (severity: number): "default" | "secondary" | "destructive" | "outline" => {
  if (severity <= 3) return "secondary";
  if (severity <= 6) return "default";
  return "destructive";
};

export function SymptomCorrelations({ symptoms }: SymptomCorrelationsProps) {
  // Calculate medication correlations
  const medicationCorrelations = useMemo<MedicationCorrelation[]>(() => {
    const medMap = new Map<string, { 
      name: string; 
      symptoms: Map<string, { count: number; totalSeverity: number }>;
      totalSeverity: number;
    }>();

    symptoms.forEach((s) => {
      if (!s.medication_id || !s.medications?.name) return;

      if (!medMap.has(s.medication_id)) {
        medMap.set(s.medication_id, {
          name: s.medications.name,
          symptoms: new Map(),
          totalSeverity: 0,
        });
      }

      const med = medMap.get(s.medication_id)!;
      med.totalSeverity += s.severity;

      if (!med.symptoms.has(s.symptom_type)) {
        med.symptoms.set(s.symptom_type, { count: 0, totalSeverity: 0 });
      }
      const symptomData = med.symptoms.get(s.symptom_type)!;
      symptomData.count++;
      symptomData.totalSeverity += s.severity;
    });

    return Array.from(medMap.entries())
      .map(([id, data]) => {
        const totalSymptoms = Array.from(data.symptoms.values()).reduce((sum, s) => sum + s.count, 0);
        return {
          medicationId: id,
          medicationName: data.name,
          totalSymptoms,
          avgSeverity: totalSymptoms > 0 ? data.totalSeverity / totalSymptoms : 0,
          symptomBreakdown: Array.from(data.symptoms.entries())
            .map(([type, stats]) => ({
              symptomType: type,
              count: stats.count,
              avgSeverity: stats.totalSeverity / stats.count,
              percentage: (stats.count / totalSymptoms) * 100,
            }))
            .sort((a, b) => b.count - a.count),
        };
      })
      .filter((m) => m.totalSymptoms > 0)
      .sort((a, b) => b.avgSeverity - a.avgSeverity);
  }, [symptoms]);

  // Calculate symptom patterns
  const symptomPatterns = useMemo<SymptomPattern[]>(() => {
    const patternMap = new Map<string, {
      totalCount: number;
      linkedSymptoms: CachedSymptomEntry[];
      unlinkedSymptoms: CachedSymptomEntry[];
      medicationCounts: Map<string, { name: string; count: number; totalSeverity: number }>;
    }>();

    symptoms.forEach((s) => {
      if (!patternMap.has(s.symptom_type)) {
        patternMap.set(s.symptom_type, {
          totalCount: 0,
          linkedSymptoms: [],
          unlinkedSymptoms: [],
          medicationCounts: new Map(),
        });
      }

      const pattern = patternMap.get(s.symptom_type)!;
      pattern.totalCount++;

      if (s.medication_id && s.medications?.name) {
        pattern.linkedSymptoms.push(s);
        
        if (!pattern.medicationCounts.has(s.medication_id)) {
          pattern.medicationCounts.set(s.medication_id, { 
            name: s.medications.name, 
            count: 0, 
            totalSeverity: 0 
          });
        }
        const medData = pattern.medicationCounts.get(s.medication_id)!;
        medData.count++;
        medData.totalSeverity += s.severity;
      } else {
        pattern.unlinkedSymptoms.push(s);
      }
    });

    return Array.from(patternMap.entries())
      .map(([type, data]) => {
        const avgSeverityWithMed = data.linkedSymptoms.length > 0
          ? data.linkedSymptoms.reduce((sum, s) => sum + s.severity, 0) / data.linkedSymptoms.length
          : 0;
        const avgSeverityWithoutMed = data.unlinkedSymptoms.length > 0
          ? data.unlinkedSymptoms.reduce((sum, s) => sum + s.severity, 0) / data.unlinkedSymptoms.length
          : 0;

        return {
          symptomType: type,
          totalCount: data.totalCount,
          linkedToMedication: data.linkedSymptoms.length,
          unlinkedCount: data.unlinkedSymptoms.length,
          avgSeverityWithMed,
          avgSeverityWithoutMed,
          topMedications: Array.from(data.medicationCounts.values())
            .map((m) => ({
              name: m.name,
              count: m.count,
              avgSeverity: m.totalSeverity / m.count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3),
        };
      })
      .filter((p) => p.totalCount >= 2)
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [symptoms]);

  // Find high-severity correlations (potential warnings)
  const warnings = useMemo(() => {
    const alerts: { medication: string; symptom: string; avgSeverity: number; count: number }[] = [];
    
    medicationCorrelations.forEach((med) => {
      med.symptomBreakdown.forEach((symptom) => {
        if (symptom.avgSeverity >= 7 && symptom.count >= 2) {
          alerts.push({
            medication: med.medicationName,
            symptom: symptom.symptomType,
            avgSeverity: symptom.avgSeverity,
            count: symptom.count,
          });
        }
      });
    });

    return alerts.sort((a, b) => b.avgSeverity - a.avgSeverity).slice(0, 3);
  }, [medicationCorrelations]);

  if (symptoms.length < 3) {
    return null;
  }

  const hasCorrelations = medicationCorrelations.length > 0 || symptomPatterns.length > 0;

  if (!hasCorrelations) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          Correlation Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* High Severity Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Potential Concerns
            </h3>
            <div className="space-y-2">
              {warnings.map((warning, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20"
                >
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{warning.medication}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{warning.symptom}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">
                      Avg: {warning.avgSeverity.toFixed(1)}/10
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({warning.count} times)
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              These medication-symptom pairs show consistently high severity. Consider discussing with your clinician.
            </p>
          </div>
        )}

        {/* Medication Impact Summary */}
        {medicationCorrelations.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Medication Impact
            </h3>
            <div className="space-y-3">
              {medicationCorrelations.slice(0, 4).map((med) => (
                <div key={med.medicationId} className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{med.medicationName}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={getSeverityBadgeVariant(med.avgSeverity)}>
                        Avg: {med.avgSeverity.toFixed(1)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {med.totalSymptoms} symptom{med.totalSymptoms !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {med.symptomBreakdown.slice(0, 4).map((symptom) => (
                      <Badge 
                        key={symptom.symptomType} 
                        variant="outline" 
                        className="text-xs"
                      >
                        {symptom.symptomType} ({symptom.count})
                      </Badge>
                    ))}
                    {med.symptomBreakdown.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{med.symptomBreakdown.length - 4} more
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Symptom Patterns */}
        {symptomPatterns.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Symptom Patterns
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {symptomPatterns.slice(0, 4).map((pattern) => {
                const linkedPercentage = (pattern.linkedToMedication / pattern.totalCount) * 100;
                const severityLevel = getSeverityLevel(
                  pattern.avgSeverityWithMed > 0 ? pattern.avgSeverityWithMed : pattern.avgSeverityWithoutMed
                );

                return (
                  <div 
                    key={pattern.symptomType} 
                    className="p-3 rounded-lg border bg-card space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{pattern.symptomType}</span>
                      <span className="text-xs text-muted-foreground">
                        {pattern.totalCount} entries
                      </span>
                    </div>
                    
                    {pattern.linkedToMedication > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Linked to medication</span>
                          <span>{linkedPercentage.toFixed(0)}%</span>
                        </div>
                        <Progress value={linkedPercentage} className="h-1.5" />
                      </div>
                    )}

                    {pattern.topMedications.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {pattern.topMedications.map((med) => (
                          <Badge 
                            key={med.name} 
                            variant="secondary" 
                            className="text-xs"
                          >
                            {med.name}
                            <span className={`ml-1 ${getSeverityLevel(med.avgSeverity).color}`}>
                              ({med.avgSeverity.toFixed(1)})
                            </span>
                          </Badge>
                        ))}
                      </div>
                    )}

                    {pattern.linkedToMedication > 0 && pattern.unlinkedCount > 0 && (
                      <div className="text-xs text-muted-foreground pt-1">
                        {pattern.avgSeverityWithMed > pattern.avgSeverityWithoutMed ? (
                          <span className="text-warning">
                            Higher severity when linked to medication
                          </span>
                        ) : pattern.avgSeverityWithMed < pattern.avgSeverityWithoutMed ? (
                          <span className="text-primary">
                            Lower severity when linked to medication
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center pt-2">
          Insights are based on your logged symptoms. Always consult your healthcare provider about medication side effects.
        </p>
      </CardContent>
    </Card>
  );
}
