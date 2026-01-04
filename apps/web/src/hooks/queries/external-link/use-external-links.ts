import { useQuery } from "@tanstack/react-query";
import getExternalLinks from "@/fetchers/external-link/get-external-links";

function useExternalLinks(taskId: string) {
  return useQuery({
    queryKey: ["external-links", taskId],
    queryFn: () => getExternalLinks(taskId),
    enabled: !!taskId,
  });
}

export default useExternalLinks;
