import { useQuery } from "@tanstack/react-query";
import getCustomFieldsByProject from "@/fetchers/custom-field/get-custom-fields-by-project";

function useGetCustomFieldsByProject(projectId: string) {
  return useQuery({
    queryKey: ["custom-fields", projectId],
    queryFn: () => getCustomFieldsByProject({ projectId }),
    enabled: !!projectId,
  });
}

export default useGetCustomFieldsByProject;