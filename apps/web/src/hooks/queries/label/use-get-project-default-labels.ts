import { useQuery } from "@tanstack/react-query";
import getProjectDefaultLabels from "@/fetchers/label/get-project-default-labels";

export const projectDefaultLabelsKey = (projectId: string) =>
  ["labels", "project-defaults", projectId] as const;

function useGetProjectDefaultLabels(projectId: string) {
  return useQuery({
    enabled: Boolean(projectId),
    queryKey: projectDefaultLabelsKey(projectId),
    queryFn: () => getProjectDefaultLabels(projectId),
  });
}

export default useGetProjectDefaultLabels;
