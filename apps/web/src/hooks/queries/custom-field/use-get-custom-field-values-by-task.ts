import { useQuery } from "@tanstack/react-query";
import getCustomFieldValuesByTask from "@/fetchers/custom-field/get-custom-field-values-by-task";

function useGetCustomFieldValuesByTask(taskId: string) {
    return useQuery({
        queryKey: ["custom-field-values", taskId],
        queryFn: () => getCustomFieldValuesByTask({ taskId }),
        enabled: !!taskId,
    });
}

export default useGetCustomFieldValuesByTask;