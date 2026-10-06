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
      <div className="space-y-1">
        <Label htmlFor={id} className="text-sm font-medium">
          {t("settings:advancedSettings")}
        </Label>
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {t("settings:advancedSettingsDescription")}
        </p>
      </div>
      <Switch
        id={id}
        aria-label={t("settings:advancedSettings")}
        aria-describedby={`${id}-description`}
        checked={advancedSettings}
        onCheckedChange={setAdvancedSettings}
      />
    </div>
  );
}
