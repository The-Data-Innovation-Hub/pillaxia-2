/**
 * Quick actions card for the patient dashboard.
 * Provides shortcuts to common patient actions.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, ClipboardList, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      label: "Add Medication",
      icon: Plus,
      path: "/dashboard/medications",
      ariaLabel: "Navigate to add medication",
    },
    {
      label: "View Schedule",
      icon: Calendar,
      path: "/dashboard/schedule",
      ariaLabel: "Navigate to view schedule",
    },
    {
      label: "Log Symptom",
      icon: ClipboardList,
      path: "/dashboard/symptoms",
      ariaLabel: "Navigate to log symptom",
    },
    {
      label: "Ask Angela",
      icon: Bot,
      path: "/dashboard/angela",
      ariaLabel: "Navigate to AI assistant Angela",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
          role="navigation"
          aria-label="Quick actions"
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
