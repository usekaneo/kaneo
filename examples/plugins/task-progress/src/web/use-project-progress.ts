import { usePluginApi } from "@kaneo/plugin-sdk/web";
import { useQuery } from "@tanstack/react-query";
import { projectProgressPath } from "./progress-paths.js";
import { projectProgressKey } from "./query-keys.js";

type ProjectProgress = {
  progress: Record<string, number>;
};

export function useProjectProgress(projectId: string) {
  const api = usePluginApi();
  return useQuery({
    queryKey: projectProgressKey(projectId),
    queryFn: () => api.get<ProjectProgress>(projectProgressPath(projectId)),
    select: (data) => data.progress,
  });
}
