import { TwoFactorSettingsCard } from "@/components/patient/TwoFactorSettingsCard";

export function SecuritySettingsTab() {
  return (
    <div className="space-y-6">
      {/* Two-Factor Authentication */}
      <TwoFactorSettingsCard />
    </div>
  );
}
