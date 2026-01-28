import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, FileText, Activity, ClipboardList } from "lucide-react";
import { HealthProfileContent } from "./HealthProfileContent";
import { LabResultsContent } from "./LabResultsContent";
import { VitalsContent } from "./VitalsContent";
import { SymptomsContent } from "./SymptomsContent";

export function HealthHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Health</h1>
        <p className="text-muted-foreground">
          Manage your health profile, vitals, lab results, and symptoms
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full max-w-2xl grid grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="vitals" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Vitals</span>
          </TabsTrigger>
          <TabsTrigger value="labs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Lab Results</span>
          </TabsTrigger>
          <TabsTrigger value="symptoms" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Symptoms</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <HealthProfileContent />
        </TabsContent>

        <TabsContent value="vitals" className="mt-6">
          <VitalsContent />
        </TabsContent>

        <TabsContent value="labs" className="mt-6">
          <LabResultsContent />
        </TabsContent>

        <TabsContent value="symptoms" className="mt-6">
          <SymptomsContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
