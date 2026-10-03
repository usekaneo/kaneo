import { useQuery } from "@tanstack/react-query";
import getColumns from "@/fetchers/column/get-columns";

export function useGetColumns(projectId: string, refreshOnMount = false) {
  return useQuery({
    queryKey: ["columns", projectId],
    queryFn: () => getColumns(projectId),
    enabled: !!projectId,
    ...(refreshOnMount
      ? {
          refetchOnMount: "always" as const,
          refetchOnWindowFocus: "always" as const,
        }
      : {}),
  });
}
