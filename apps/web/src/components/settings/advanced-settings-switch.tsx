import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function AdvancedSettingsSwitch() {
  const { t } = useTranslation();
  const id = useId();
  const advancedSettings = useUserPreferencesStore(
    (state) => state.advancedSettings,
  );
  const setAdvancedSettings = useUserPreferencesStore(
    (state) => state.setAdvancedSettings,
  );

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <Label htmlFor={id} className="text-sm font-medium">
        {t("settings:advancedSettings")}
      </Label>
      <Switch
        id={id}
        aria-label={t("settings:advancedSettings")}
        checked={advancedSettings}
        onCheckedChange={setAdvancedSettings}
      />
    </div>
  );
}
