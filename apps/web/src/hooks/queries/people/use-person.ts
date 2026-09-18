import { useQuery } from "@tanstack/react-query";
import getPerson from "@/fetchers/people/get-person";

function usePerson(workspaceId: string | undefined, userId: string) {
  return useQuery({
    queryKey: ["people", workspaceId, userId],
    queryFn: () => getPerson(workspaceId as string, userId),
    enabled: !!workspaceId && !!userId,
    retry: false,
  });
}

export default usePerson;
