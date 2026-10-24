import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Habit } from "@/fetchers/habit/get-habits";
import setHabitCheck from "@/fetchers/habit/set-habit-check";
import { HABITS_KEY } from "@/hooks/queries/habit/use-get-habits";

type Variables = { id: string; date: string; done: boolean };

// Ticking a day should feel instant, so the grid and count update before the
// request lands and roll back if it fails.
function useSetHabitCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setHabitCheck,
    onMutate: async ({ id, date, done }: Variables) => {
      await queryClient.cancelQueries({ queryKey: HABITS_KEY });
      const previous = queryClient.getQueriesData<Habit[]>({
        queryKey: HABITS_KEY,
      });
      queryClient.setQueriesData<Habit[]>({ queryKey: HABITS_KEY }, (habits) =>
        habits?.map((habit) => {
          if (habit.id !== id || habit.checks.includes(date) === done)
            return habit;
          return {
            ...habit,
            doneCount: habit.doneCount + (done ? 1 : -1),
            checks: done
              ? [...habit.checks, date]
              : habit.checks.filter((day) => day !== date),
          };
        }),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.previous ?? [])
        queryClient.setQueryData(key, data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: HABITS_KEY }),
  });
}

export default useSetHabitCheck;
