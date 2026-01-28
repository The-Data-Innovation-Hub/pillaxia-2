import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Eye } from "lucide-react";
import { useHasCaregiverRelationships } from "@/hooks/useHasCaregiverRelationships";

// Import the content components (we'll extract the content parts)
import { CaregiversPageContent } from "./CaregiversPageContent";
import { CaregiverDashboardContent } from "./CaregiverDashboardContent";

export function CaregiversHubPage() {
  const { data: hasCaregiverRelationships } = useHasCaregiverRelationships();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Caregivers</h1>
        <p className="text-muted-foreground">
          Manage caregiver access and monitor patients you care for
        </p>
      </div>

      <Tabs defaultValue="manage" className="w-full">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Manage Caregivers</span>
          </TabsTrigger>
          {hasCaregiverRelationships && (
            <TabsTrigger value="view" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span>Caregiver View</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="manage" className="mt-6">
          <CaregiversPageContent />
        </TabsContent>

        {hasCaregiverRelationships && (
          <TabsContent value="view" className="mt-6">
            <CaregiverDashboardContent />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
