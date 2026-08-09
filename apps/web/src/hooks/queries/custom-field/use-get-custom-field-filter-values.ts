import { useQuery } from "@tanstack/react-query";
import getCustomFieldFilterValues from "@/fetchers/custom-field/get-custom-field-filter-values";

function useGetCustomFieldFilterValues(projectId: string) {
  return useQuery({
    queryKey: ["custom-field-filter-values", projectId],
    queryFn: () => getCustomFieldFilterValues({ projectId }),
    enabled: !!projectId,
  });
}

export default useGetCustomFieldFilterValues;
