import { useQuery } from "@tanstack/react-query";
import { getExternalLinks } from "../../../fetchers/external-links";

export function useGetExternalLinks(taskId: string) {
  return useQuery({
    queryKey: ["external-links", taskId],
    queryFn: () => getExternalLinks(taskId),
    enabled: !!taskId,
  });
}
