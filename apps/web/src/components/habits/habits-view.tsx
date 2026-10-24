import { parseISO } from "date-fns";
import { ListChecks } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateHabit,
  useDeleteHabit,
  useRenameHabit,
} from "@/hooks/mutations/habit/use-save-habit";
import useSetHabitCheck from "@/hooks/mutations/habit/use-set-habit-check";
import useGetHabits from "@/hooks/queries/habit/use-get-habits";
import { toast } from "@/lib/toast";
import { habitDays, toDateKey } from "./habit-days";
import { HabitNameInput } from "./habit-name-input";
import { HabitsGrid } from "./habits-grid";

export function HabitsView() {
  const { t } = useTranslation();
  const today = toDateKey(new Date());
  // Recomputed when the date changes, so the grid moves on after midnight.
  const days = useMemo(() => habitDays(parseISO(today)), [today]);
  const range = {
    from: days[0]?.date ?? today,
    to: days.at(-1)?.date ?? today,
  };
  const { data: habits, isLoading, isError } = useGetHabits(range);
  const createHabit = useCreateHabit();
  const renameHabit = useRenameHabit();
  const deleteHabit = useDeleteHabit();
  const setCheck = useSetHabitCheck();
  const onError = () => toast.error(t("navigation:habits.saveError"));

  return (
    <div className="flex flex-col gap-4 p-4 md:px-6">
      <p className="max-w-prose text-muted-foreground text-sm">
        {t("navigation:habits.description")}
      </p>
      {isLoading ? (
        <Skeleton className="h-40 w-full max-w-4xl rounded-xl" />
      ) : isError || !habits ? (
        <p role="alert" className="text-muted-foreground text-sm">
          {t("navigation:habits.loadError")}
        </p>
      ) : habits.length === 0 ? (
        <Empty className="min-h-[30vh]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecks />
            </EmptyMedia>
            <EmptyTitle>{t("navigation:habits.emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("navigation:habits.emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <HabitsGrid
          habits={habits}
          days={days}
          onToggle={(habit, date, done) =>
            setCheck.mutate({ id: habit.id, date, done }, { onError })
          }
          onRename={(habit, name) =>
            renameHabit.mutate({ id: habit.id, name }, { onError })
          }
          onDelete={(habit) => deleteHabit.mutate(habit.id, { onError })}
        />
      )}
      <div className="w-60">
        <HabitNameInput
          ariaLabel={t("navigation:habits.add")}
          placeholder={t("navigation:habits.addPlaceholder")}
          onSubmit={(name) => createHabit.mutate(name, { onError })}
        />
      </div>
    </div>
  );
}
