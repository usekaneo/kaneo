import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PreferenceSwitchRow } from "@/components/settings/preferences/preference-switch-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function TaskDetailsSection() {
  const { t } = useTranslation();
  const {
    showTaskNumbers,
    setShowTaskNumbers,
    showAssignees,
    setShowAssignees,
    showDueDates,
    setShowDueDates,
    showLabels,
    setShowLabels,
    showPriority,
    setShowPriority,
    resetDisplayPreferences,
  } = useUserPreferencesStore();

  const rows = [
    {
      id: "taskNumbers",
      title: t("settings:preferencesPage.taskNumbers"),
      checked: showTaskNumbers,
      onCheckedChange: setShowTaskNumbers,
    },
    {
      id: "assignees",
      title: t("settings:preferencesPage.assignees"),
      checked: showAssignees,
      onCheckedChange: setShowAssignees,
    },
    {
      id: "dueDates",
      title: t("settings:preferencesPage.dueDates"),
      checked: showDueDates,
      onCheckedChange: setShowDueDates,
    },
    {
      id: "labels",
      title: t("settings:preferencesPage.labels"),
      checked: showLabels,
      onCheckedChange: setShowLabels,
    },
    {
      id: "priority",
      title: t("settings:preferencesPage.priority"),
      checked: showPriority,
      onCheckedChange: setShowPriority,
    },
  ];

  return (
    <SettingsSection
      title={t("settings:preferencesPage.displayOptions")}
      description={t("settings:preferencesPage.displayOptionsDescription")}
      action={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={resetDisplayPreferences}
        >
          <RotateCcw aria-hidden="true" />
          {t("common:actions.reset")}
        </Button>
      }
    >
      <SettingsCard>
        {rows.map((row) => (
          <PreferenceSwitchRow
            key={row.id}
            title={row.title}
            checked={row.checked}
            onCheckedChange={row.onCheckedChange}
          />
        ))}
      </SettingsCard>
    </SettingsSection>
  );
}
