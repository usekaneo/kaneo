import { useTranslation } from "react-i18next";
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

export function WeekStartControl() {
  const { t } = useTranslation();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const setWeekStartsOn = useUserPreferencesStore(
    (state) => state.setWeekStartsOn,
  );
  const label = t("settings:preferencesPage.firstDayOfWeek");
  const days: Record<WeekStartDay, string> = {
    0: t("settings:preferencesPage.weekStartsOnSunday"),
    1: t("settings:preferencesPage.weekStartsOnMonday"),
    6: t("settings:preferencesPage.weekStartsOnSaturday"),
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Select
        value={String(weekStartsOn)}
        onValueChange={(value) => {
          const parsed = Number(value);
          if (isWeekStartDay(parsed)) setWeekStartsOn(parsed);
        }}
      >
        <SelectTrigger size="sm" className="w-36" aria-label={label}>
          <SelectValue>{days[weekStartsOn]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {WEEK_START_DAYS.map((day) => (
            <SelectItem key={day} value={String(day)}>
              {days[day]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
