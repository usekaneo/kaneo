import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { ClassicPriorityIcon } from "@/components/task-chips/classic-priority-icon";
import { PriorityMarks } from "@/components/task-chips/priority-marks";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUserPreferencesStore } from "@/store/user-preferences";

const PREVIEW_LEVELS = ["low", "high", "urgent"];

export function PriorityIconsRow() {
  const { t } = useTranslation();
  const priorityIconStyle = useUserPreferencesStore(
    (state) => state.priorityIconStyle,
  );
  const setPriorityIconStyle = useUserPreferencesStore(
    (state) => state.setPriorityIconStyle,
  );

  return (
    <SettingsRow
      stack
      title={t("settings:preferencesPage.priorityIcons")}
      description={t("settings:preferencesPage.priorityIconsDescription")}
    >
      <ToggleGroup
        value={[priorityIconStyle]}
        onValueChange={(values) => {
          const next = values[0];
          if (next === "marks" || next === "classic") {
            setPriorityIconStyle(next);
          }
        }}
        size="sm"
        aria-label={t("settings:preferencesPage.priorityIcons")}
        className="w-full rounded-lg border border-input bg-background p-0.5 sm:w-auto dark:bg-input/32"
      >
        <ToggleGroupItem value="marks" className="h-7 flex-1 gap-1.5 sm:h-6">
          {t("settings:preferencesPage.priorityIconsMarks")}
          <span className="flex items-center gap-0.5 [&_svg]:mx-0!">
            {PREVIEW_LEVELS.map((level) => (
              <PriorityMarks key={level} priority={level} />
            ))}
          </span>
        </ToggleGroupItem>
        <ToggleGroupItem value="classic" className="h-7 flex-1 gap-1.5 sm:h-6">
          {t("settings:preferencesPage.priorityIconsClassic")}
          <span className="flex items-center gap-0.5 [&_svg]:mx-0!">
            {PREVIEW_LEVELS.map((level) => (
              <ClassicPriorityIcon key={level} priority={level} />
            ))}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>
    </SettingsRow>
  );
}
