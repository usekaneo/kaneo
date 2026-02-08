import { useQuery } from "@tanstack/react-query";
import getColumns from "@/fetchers/column/get-columns";

export function useGetColumns(projectId: string) {
  return useQuery({
    queryKey: ["columns", projectId],
    queryFn: () => getColumns(projectId),
    enabled: !!projectId,
  });
}
