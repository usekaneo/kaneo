import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function CalendarDisplayOptions() {
  const { t } = useTranslation();
  const wrapId = useId();
  const allId = useId();
  const wrap = useUserPreferencesStore((state) => state.calendarWrapTaskTitles);
  const setWrap = useUserPreferencesStore(
    (state) => state.setCalendarWrapTaskTitles,
  );
  const showAll = useUserPreferencesStore(
    (state) => state.calendarShowAllTasks,
  );
  const setShowAll = useUserPreferencesStore(
    (state) => state.setCalendarShowAllTasks,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={wrapId} className="text-sm">
          {t("tasks:calendar.wrapTaskTitles")}
        </label>
        <Switch id={wrapId} checked={wrap} onCheckedChange={setWrap} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={allId} className="text-sm">
          {t("tasks:calendar.showAllTasks")}
        </label>
        <Switch id={allId} checked={showAll} onCheckedChange={setShowAll} />
      </div>
    </div>
  );
}
