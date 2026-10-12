import { useTranslation } from "react-i18next";
import { PreferenceSwitchRow } from "@/components/settings/preferences/preference-switch-row";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function AdvancedSettingsSwitch() {
  const { t } = useTranslation();
  const advancedSettings = useUserPreferencesStore(
    (state) => state.advancedSettings,
  );
  const setAdvancedSettings = useUserPreferencesStore(
    (state) => state.setAdvancedSettings,
  );

  return (
    <PreferenceSwitchRow
      title={t("settings:advancedSettings")}
      description={t("settings:advancedSettingsDescription")}
      checked={advancedSettings}
      onCheckedChange={setAdvancedSettings}
    />
  );
}
