import { useTranslation } from "react-i18next";
import { ThemePicker } from "@/components/account/theme-picker";
import { AdvancedSettingsSwitch } from "@/components/settings/advanced-settings-switch";
import { AutosaveNote } from "@/components/settings/autosave-note";
import { GeneralPreferencesSection } from "@/components/settings/preferences/general-preferences-section";
import { TaskDetailsSection } from "@/components/settings/preferences/task-details-section";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSection } from "@/components/settings/settings-section";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function PreferencesPage() {
  const { t } = useTranslation();
  const theme = useUserPreferencesStore((state) => state.theme);
  const setTheme = useUserPreferencesStore((state) => state.setTheme);

  return (
    <SettingsPage
      title={t("settings:preferencesPage.title")}
      description={t("settings:preferencesPage.subtitle")}
      actions={<AutosaveNote />}
    >
      <SettingsSection title={t("settings:preferencesPage.theme")}>
        <ThemePicker value={theme} onChange={setTheme} />
      </SettingsSection>
      <GeneralPreferencesSection />
      <TaskDetailsSection />
      <SettingsSection title={t("settings:preferencesPage.advancedTitle")}>
        <SettingsCard>
          <AdvancedSettingsSwitch />
        </SettingsCard>
      </SettingsSection>
    </SettingsPage>
  );
}
