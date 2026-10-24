import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Habit } from "@/fetchers/habit/get-habits";
import { cn } from "@/lib/cn";
import { HabitCheckCell } from "./habit-check-cell";
import type { HabitDay } from "./habit-days";
import { HabitNameInput } from "./habit-name-input";
import { HabitRowMenu } from "./habit-row-menu";

type HabitRowProps = {
  habit: Habit;
  days: readonly HabitDay[];
  formatDay: (date: Date) => string;
  onToggle: (date: string, done: boolean) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

export function HabitRow({
  habit,
  days,
  formatDay,
  onToggle,
  onRename,
  onDelete,
}: HabitRowProps) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const done = new Set(habit.checks);

  return (
    <tr className="group/habit border-border/60 border-t">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-background px-2 py-1.5 text-left font-normal"
      >
        <div className="flex w-56 items-center gap-1.5">
          {renaming ? (
            <HabitNameInput
              initial={habit.name}
              ariaLabel={t("navigation:habits.rename")}
              autoFocus
              onSubmit={(name) => {
                setRenaming(false);
                onRename(name);
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <>
              <span className="min-w-0 truncate text-sm" title={habit.name}>
                {habit.name}
              </span>
              <span
                className="shrink-0 rounded-full bg-emerald-500/12 px-1.5 font-medium text-[11px] text-emerald-700 tabular-nums dark:text-emerald-400"
                title={t("navigation:habits.daysDone", {
                  count: habit.doneCount,
                })}
              >
                {habit.doneCount}
              </span>
              <span className="ml-auto">
                <HabitRowMenu
                  name={habit.name}
                  onRename={() => setRenaming(true)}
                  onDelete={onDelete}
                />
              </span>
            </>
          )}
        </div>
      </th>
      {days.map((day) => {
        const isDone = done.has(day.date);
        return (
          <td
            key={day.date}
            className={cn(
              "px-0.5 py-1.5 text-center",
              day.isToday && "bg-accent/60",
            )}
          >
            <div className="flex justify-center">
              <HabitCheckCell
                done={isDone}
                disabled={day.isFuture}
                label={t("navigation:habits.checkLabel", {
                  habit: habit.name,
                  date: formatDay(day.value),
                })}
                onToggle={() => onToggle(day.date, !isDone)}
              />
            </div>
          </td>
        );
      })}
    </tr>
  );
}
