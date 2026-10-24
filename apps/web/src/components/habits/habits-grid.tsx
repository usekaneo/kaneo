import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Habit } from "@/fetchers/habit/get-habits";
import { cn } from "@/lib/cn";
import { type HabitDay, monthSpans } from "./habit-days";
import { HabitRow } from "./habit-row";

type HabitsGridProps = {
  habits: readonly Habit[];
  days: readonly HabitDay[];
  onToggle: (habit: Habit, date: string, done: boolean) => void;
  onRename: (habit: Habit, name: string) => void;
  onDelete: (habit: Habit) => void;
};

export function HabitsGrid({
  habits,
  days,
  onToggle,
  onRename,
  onDelete,
}: HabitsGridProps) {
  const { t, i18n } = useTranslation();
  const formats = useMemo(
    () => ({
      month: new Intl.DateTimeFormat(i18n.language, { month: "long" }),
      weekday: new Intl.DateTimeFormat(i18n.language, { weekday: "narrow" }),
      full: new Intl.DateTimeFormat(i18n.language, { dateStyle: "full" }),
    }),
    [i18n.language],
  );

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-background" />
            {monthSpans(days).map((span) => (
              <th
                key={span.month.toISOString()}
                colSpan={span.days}
                className="border-border/60 border-l px-1 pb-1 text-left font-medium text-muted-foreground text-xs capitalize first-of-type:border-l-0"
              >
                {formats.month.format(span.month)}
              </th>
            ))}
          </tr>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 bg-background pr-1.5 pb-1.5 text-left font-medium text-muted-foreground text-xs md:px-2"
            >
              {t("navigation:habits.habit")}
            </th>
            {days.map((day) => (
              <th
                key={day.date}
                scope="col"
                title={formats.full.format(day.value)}
                aria-current={day.isToday ? "date" : undefined}
                className={cn(
                  "min-w-8 px-0.5 pb-1.5 text-center font-normal text-[11px] tabular-nums",
                  day.isToday
                    ? "rounded-t-md bg-accent/60 font-semibold text-foreground"
                    : day.isWeekend
                      ? "text-muted-foreground/60"
                      : "text-muted-foreground",
                )}
              >
                <span className="block uppercase">
                  {formats.weekday.format(day.value)}
                </span>
                <span className="block">{day.value.getDate()}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              days={days}
              formatDay={(date) => formats.full.format(date)}
              onToggle={(date, done) => onToggle(habit, date, done)}
              onRename={(name) => onRename(habit, name)}
              onDelete={() => onDelete(habit)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
