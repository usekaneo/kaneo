import { useQuery } from "@tanstack/react-query";
import {
  getSharedTask,
  getSharedTaskDescription,
} from "@/fetchers/shared-task";

export function useGetSharedTask(token: string) {
  return useQuery({
    queryKey: ["shared-task", token],
    queryFn: ({ signal }) => getSharedTask(token, signal),
    retry: false,
    staleTime: 0,
  });
}

export function useGetSharedTaskDescription(token: string, deferred: boolean) {
  return useQuery({
    queryKey: ["shared-task", token, "description"],
    queryFn: ({ signal }) => getSharedTaskDescription(token, signal),
    enabled: deferred,
    retry: false,
    staleTime: 0,
  });
}
