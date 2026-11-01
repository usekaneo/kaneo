import type { TFunction } from "i18next";
import { formatWeekday } from "@/lib/format-recurrence";
import type { Automation } from "@/types/agent-automation";

// ISO weekday (1 = Monday … 7 = Sunday) to JavaScript's (0 = Sunday).
export const isoToJsWeekday = (day: number) => day % 7;
export const jsToIsoWeekday = (day: number) => (day === 0 ? 7 : day);

export function formatScheduleTime(time: string, locale: string) {
  const [hours, minutes] = time.split(":").map(Number);
  if (hours === undefined || minutes === undefined) return time;
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hours, minutes)));
}

function formatWeekdays(weekdays: number[], locale: string) {
  const sorted = [...weekdays].sort((a, b) => a - b);
  return new Intl.ListFormat(locale, { style: "short", type: "unit" }).format(
    sorted.map((day) => formatWeekday(isoToJsWeekday(day), locale, "short")),
  );
}

// One line such as "Mon, Thu at 9:00 · Europe/Berlin" or
// "Task created · label is Bug".
export function describeAutomationTrigger(
  trigger: Automation["trigger"],
  t: TFunction,
  locale: string,
  projectName?: (projectId: string) => string | undefined,
) {
  if (trigger.type === "schedule") {
    const time = formatScheduleTime(trigger.time, locale);
    if (trigger.frequency === "interval")
      return t("agent:automations.trigger.everyHours", {
        count: trigger.intervalHours ?? 1,
      });
    const when =
      trigger.frequency === "daily" || trigger.weekdays.length === 7
        ? t("agent:automations.trigger.dailyAt", { time })
        : t("agent:automations.trigger.weeklyAt", {
            days: formatWeekdays(trigger.weekdays, locale),
            time,
          });
    return `${when} · ${trigger.timezone}`;
  }

  const parts = [t(`agent:automations.events.${trigger.event}`)];
  const { labelName, columnName, projectId } = trigger.filters;
  if (labelName)
    parts.push(t("agent:automations.filters.labelIs", { name: labelName }));
  if (columnName)
    parts.push(t("agent:automations.filters.columnIs", { name: columnName }));
  const project = projectId ? projectName?.(projectId) : undefined;
  if (project)
    parts.push(t("agent:automations.filters.projectIs", { name: project }));
  return parts.join(" · ");
}
