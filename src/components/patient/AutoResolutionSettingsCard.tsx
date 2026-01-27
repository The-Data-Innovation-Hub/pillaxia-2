import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Zap, RotateCcw, Info, Clock, GitMerge, Server, Laptop } from "lucide-react";
import { useAutoResolutionPreferences, AutoResolutionPreferences } from "@/hooks/useAutoResolutionPreferences";
import { useLanguage } from "@/i18n/LanguageContext";

export function AutoResolutionSettingsCard() {
  const { t } = useLanguage();
  const { preferences, savePreferences, resetToDefaults, isSaving, isDefault } = useAutoResolutionPreferences();

  const handleToggle = (key: keyof AutoResolutionPreferences, value: boolean) => {
    savePreferences({ [key]: value });
  };

  const handleStrategyChange = (value: "local" | "server" | "latest") => {
    savePreferences({ preferredStrategy: value });
  };

  const handleThresholdChange = (value: number[]) => {
    savePreferences({ timeDifferenceThreshold: value[0] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          {t.autoResolution?.settingsTitle || "Auto-Resolution Settings"}
        </CardTitle>
        <CardDescription>
          {t.autoResolution?.settingsDescription || "Configure how sync conflicts are automatically resolved"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <div>
              <Label htmlFor="auto_resolution_enabled" className="font-medium">
                {t.autoResolution?.enableAuto || "Enable Auto-Resolution"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t.autoResolution?.enableAutoDesc || "Automatically resolve simple conflicts without manual review"}
              </p>
            </div>
          </div>
          <Switch
            id="auto_resolution_enabled"
            checked={preferences.enabled}
            onCheckedChange={(checked) => handleToggle("enabled", checked)}
            disabled={isSaving}
          />
        </div>

        {preferences.enabled && (
          <>
            <Separator />

            {/* Preferred Strategy */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitMerge className="h-4 w-4 text-muted-foreground" />
                <div className="space-y-1">
                  <Label className="font-medium flex items-center gap-2">
                    {t.autoResolution?.preferredStrategy || "Preferred Strategy"}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs bg-popover border z-50">
                          <p className="text-sm">
                            {t.autoResolution?.strategyTooltip || 
                              "When there's no clear winner, this determines which version to prefer"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t.autoResolution?.preferredStrategyDesc || "Default preference when resolving ambiguous conflicts"}
                  </p>
                </div>
              </div>
              <Select
                value={preferences.preferredStrategy}
                onValueChange={handleStrategyChange}
                disabled={isSaving}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="latest">
                    <span className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5" />
                      {t.autoResolution?.strategyLatest || "Latest"}
                    </span>
                  </SelectItem>
                  <SelectItem value="local">
                    <span className="flex items-center gap-2">
                      <Laptop className="h-3.5 w-3.5" />
                      {t.autoResolution?.strategyLocal || "Local"}
                    </span>
                  </SelectItem>
                  <SelectItem value="server">
                    <span className="flex items-center gap-2">
                      <Server className="h-3.5 w-3.5" />
                      {t.autoResolution?.strategyServer || "Server"}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Time Difference Threshold */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <Label className="font-medium">
                    {t.autoResolution?.timeThreshold || "Time Difference Threshold"}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t.autoResolution?.timeThresholdDesc || 
                      `Minimum time difference (in seconds) to determine a clear winner: ${preferences.timeDifferenceThreshold}s`}
                  </p>
                </div>
              </div>
              <Slider
                value={[preferences.timeDifferenceThreshold]}
                onValueChange={handleThresholdChange}
                min={1}
                max={60}
                step={1}
                className="w-full"
                disabled={isSaving}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1s (strict)</span>
                <span className="font-medium">{preferences.timeDifferenceThreshold}s</span>
                <span>60s (lenient)</span>
              </div>
            </div>

            <Separator />

            {/* Single Field Auto */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 flex items-center justify-center text-muted-foreground text-xs font-bold">1</div>
                <div>
                  <Label htmlFor="allow_single_field" className="font-medium">
                    {t.autoResolution?.singleField || "Single Field Differences"}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t.autoResolution?.singleFieldDesc || "Auto-resolve when only one field differs"}
                  </p>
                </div>
              </div>
              <Switch
                id="allow_single_field"
                checked={preferences.allowSingleFieldAuto}
                onCheckedChange={(checked) => handleToggle("allowSingleFieldAuto", checked)}
                disabled={isSaving}
              />
            </div>

            <Separator />

            {/* Multi Field Auto */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 flex items-center justify-center text-muted-foreground text-xs font-bold">+</div>
                <div>
                  <Label htmlFor="allow_multi_field" className="font-medium">
                    {t.autoResolution?.multiField || "Multiple Field Differences"}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t.autoResolution?.multiFieldDesc || "Auto-resolve when multiple fields differ with same strategy"}
                  </p>
                </div>
              </div>
              <Switch
                id="allow_multi_field"
                checked={preferences.allowMultiFieldAuto}
                onCheckedChange={(checked) => handleToggle("allowMultiFieldAuto", checked)}
                disabled={isSaving}
              />
            </div>

            <Separator />

            {/* Auto Merge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GitMerge className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="allow_auto_merge" className="font-medium">
                    {t.autoResolution?.autoMerge || "Auto-Merge"}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t.autoResolution?.autoMergeDesc || "Automatically merge when result is unambiguous"}
                  </p>
                </div>
              </div>
              <Switch
                id="allow_auto_merge"
                checked={preferences.allowAutoMerge}
                onCheckedChange={(checked) => handleToggle("allowAutoMerge", checked)}
                disabled={isSaving}
              />
            </div>

            <Separator />

            {/* Reset Button */}
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefaults}
                disabled={isSaving || isDefault}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                {t.autoResolution?.resetDefaults || "Reset to Defaults"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
