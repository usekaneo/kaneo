import { useMutation, useQueryClient } from "@tanstack/react-query";
import updatePluginWorkspace from "@/fetchers/plugin/update-plugin-workspace";
import type { UpdatePluginWorkspaceRequest } from "@/types/plugin";

type UpdatePluginWorkspaceVariables = UpdatePluginWorkspaceRequest & {
  pluginId: string;
  workspaceId: string;
};

export function useUpdatePluginWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pluginId,
      workspaceId,
      ...json
    }: UpdatePluginWorkspaceVariables) =>
      updatePluginWorkspace(pluginId, workspaceId, json),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({
        queryKey: ["plugins", variables.workspaceId],
      }),
  });
}
