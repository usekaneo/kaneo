import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isWeekStartDay,
  useUserPreferencesStore,
  WEEK_START_DAYS,
  type WeekStartDay,
} from "@/store/user-preferences";

export function WeekStartRow() {
  const { t } = useTranslation();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const setWeekStartsOn = useUserPreferencesStore(
    (state) => state.setWeekStartsOn,
  );
  const labels: Record<WeekStartDay, string> = {
    0: t("settings:preferencesPage.weekStartsOnSunday"),
    1: t("settings:preferencesPage.weekStartsOnMonday"),
    6: t("settings:preferencesPage.weekStartsOnSaturday"),
  };

  return (
    <SettingsRow
      stack
      title={t("settings:preferencesPage.firstDayOfWeek")}
      description={t("settings:preferencesPage.firstDayOfWeekDescription")}
    >
      <Select
        value={String(weekStartsOn)}
        onValueChange={(value) => {
          if (!value) return;
          const parsed = Number(value);
          if (isWeekStartDay(parsed)) setWeekStartsOn(parsed);
        }}
      >
        <SelectTrigger
          size="sm"
          className="sm:w-48"
          aria-label={t("settings:preferencesPage.firstDayOfWeek")}
        >
          <SelectValue
            placeholder={t("settings:preferencesPage.selectFirstDayOfWeek")}
          >
            {labels[weekStartsOn]}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {WEEK_START_DAYS.map((day) => (
            <SelectItem key={day} value={String(day)}>
              {labels[day]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsRow>
  );
}
