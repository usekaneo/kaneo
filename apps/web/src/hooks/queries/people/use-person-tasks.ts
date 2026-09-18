import { useQuery } from "@tanstack/react-query";
import getPersonTasks from "@/fetchers/people/get-person-tasks";

function usePersonTasks(workspaceId: string | undefined, userId: string) {
  return useQuery({
    queryKey: ["people", workspaceId, userId, "tasks"],
    queryFn: () => getPersonTasks(workspaceId as string, userId),
    enabled: !!workspaceId && !!userId,
  });
}

export default usePersonTasks;
