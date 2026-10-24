import { useQuery } from "@tanstack/react-query";
import getHabits from "@/fetchers/habit/get-habits";

export const HABITS_KEY = ["habits"] as const;

export function habitsKey(range: { from: string; to: string }) {
  return [...HABITS_KEY, range.from, range.to] as const;
}

function useGetHabits(range: { from: string; to: string }) {
  return useQuery({
    queryKey: habitsKey(range),
    queryFn: () => getHabits(range),
  });
}

export default useGetHabits;
