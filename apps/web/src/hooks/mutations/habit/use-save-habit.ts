import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createHabit,
  deleteHabit,
  renameHabit,
} from "@/fetchers/habit/save-habit";
import { HABITS_KEY } from "@/hooks/queries/habit/use-get-habits";

function useInvalidateHabits() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: HABITS_KEY });
}

export function useCreateHabit() {
  const onSettled = useInvalidateHabits();
  return useMutation({ mutationFn: createHabit, onSettled });
}

export function useRenameHabit() {
  const onSettled = useInvalidateHabits();
  return useMutation({ mutationFn: renameHabit, onSettled });
}

export function useDeleteHabit() {
  const onSettled = useInvalidateHabits();
  return useMutation({ mutationFn: deleteHabit, onSettled });
}
