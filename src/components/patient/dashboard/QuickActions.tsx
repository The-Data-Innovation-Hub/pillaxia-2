/**
 * Quick actions card for the patient dashboard.
 * Provides shortcuts to common patient actions.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, ClipboardList, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

export function QuickActions() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const actions = [
    {
      label: t.medications.addMedication,
      icon: Plus,
      path: "/dashboard/medications",
      ariaLabel: t.medications.addMedication,
    },
    {
      label: t.schedule.viewSchedule,
      icon: Calendar,
      path: "/dashboard/schedule",
      ariaLabel: t.schedule.viewSchedule,
    },
    {
      label: t.health.symptoms.logSymptom,
      icon: ClipboardList,
      path: "/dashboard/symptoms",
      ariaLabel: t.health.symptoms.logSymptom,
    },
    {
      label: t.angela.askAngela,
      icon: Bot,
      path: "/dashboard/angela",
      ariaLabel: t.angela.openAssistant,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t.dashboard.quickActions}</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
          role="navigation"
          aria-label={t.dashboard.quickActions}
        >
          {actions.map((action) => (
            <Button
              key={action.path}
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={() => navigate(action.path)}
              aria-label={action.ariaLabel}
            >
              <action.icon className="h-5 w-5" aria-hidden="true" />
              <span>{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
