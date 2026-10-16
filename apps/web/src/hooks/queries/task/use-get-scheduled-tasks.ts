import { useQuery } from "@tanstack/react-query";
import getScheduledTasks from "@/fetchers/task/get-scheduled-tasks";

type UseGetScheduledTasksOptions = {
  from: string;
  to: string;
  assignedToMe?: boolean;
};

function useGetScheduledTasks(
  workspaceId: string | undefined,
  { from, to, assignedToMe = false }: UseGetScheduledTasksOptions,
) {
  return useQuery({
    queryKey: ["scheduled-tasks", workspaceId, { from, to, assignedToMe }],
    queryFn: () =>
      getScheduledTasks({
        workspaceId: workspaceId ?? "",
        from,
        to,
        assignedToMe,
      }),
    enabled: Boolean(workspaceId && from && to),
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export default useGetScheduledTasks;
