import { usePluginApi } from "@kaneo/plugin-sdk/web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { taskProgressPath } from "./progress-paths.js";
import { projectProgressKey, taskProgressKey } from "./query-keys.js";

type TaskProgress = {
  value: number;
};

export function useTaskProgress(projectId: string, taskId: string) {
  const api = usePluginApi();
  return useQuery({
    queryKey: taskProgressKey(projectId, taskId),
    queryFn: () => api.get<TaskProgress>(taskProgressPath(projectId, taskId)),
    select: (data) => data.value,
  });
}

export function useSetTaskProgress(projectId: string, taskId: string) {
  const api = usePluginApi();
  const queryClient = useQueryClient();
  const key = taskProgressKey(projectId, taskId);

  return useMutation({
    mutationFn: (value: number) =>
      api.put<TaskProgress>(taskProgressPath(projectId, taskId), { value }),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TaskProgress>(key);
      queryClient.setQueryData<TaskProgress>(key, { value });
      return { previous };
    },
    onError: (_error, _value, context) => {
      queryClient.setQueryData(key, context?.previous);
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: projectProgressKey(projectId),
      }),
  });
}
