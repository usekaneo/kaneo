import { useQuery } from "@tanstack/react-query";
import { listDepartments } from "@/fetchers/company/departments";

function useDepartments(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["departments", workspaceId],
    queryFn: () => listDepartments(workspaceId as string),
    enabled: !!workspaceId,
  });
}

export default useDepartments;
