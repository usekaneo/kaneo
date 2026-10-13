import { useQuery } from "@tanstack/react-query";
import getColumns from "@/fetchers/column/get-columns";

type ColumnRefreshOptions = {
  refreshOnMount?: boolean;
  refreshWhileVisible?: boolean;
};

export function useGetColumns(
  projectId: string,
  options: ColumnRefreshOptions = {},
) {
  return useQuery({
    queryKey: ["columns", projectId],
    queryFn: () => getColumns(projectId),
    enabled: !!projectId,
    ...(options.refreshOnMount || options.refreshWhileVisible
      ? {
          refetchOnMount: "always" as const,
          refetchOnWindowFocus: "always" as const,
        }
      : {}),
    ...(options.refreshWhileVisible ? { refetchInterval: 30_000 } : {}),
  });
}
