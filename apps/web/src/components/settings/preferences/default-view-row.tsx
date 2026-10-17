import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function DefaultViewRow() {
  const { t } = useTranslation();
  const viewMode = useUserPreferencesStore((state) => state.viewMode);
  const setViewMode = useUserPreferencesStore((state) => state.setViewMode);

  return (
    <SettingsRow
      stack
      title={t("settings:preferencesPage.defaultView")}
      description={t("settings:preferencesPage.defaultViewDescription")}
    >
      <ToggleGroup
        value={[viewMode]}
        onValueChange={(values) => {
          const next = values[0];
          if (next === "board" || next === "list") setViewMode(next);
        }}
        size="sm"
        aria-label={t("settings:preferencesPage.defaultView")}
        className="w-full rounded-lg border border-input bg-background p-0.5 sm:w-48 dark:bg-input/32"
      >
        <ToggleGroupItem value="board" className="h-7 flex-1 sm:h-6">
          {t("settings:preferencesPage.board")}
        </ToggleGroupItem>
        <ToggleGroupItem value="list" className="h-7 flex-1 sm:h-6">
          {t("settings:preferencesPage.list")}
        </ToggleGroupItem>
      </ToggleGroup>
    </SettingsRow>
  );
}
