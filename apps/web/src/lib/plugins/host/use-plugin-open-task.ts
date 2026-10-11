import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import getTask from "@/fetchers/task/get-task";
import { toast } from "@/lib/toast";
import { usePluginScope } from "./plugin-scope-context";
import { routeHostsTaskSheet } from "./route-hosts-task-sheet";

export function usePluginOpenTask(): (taskId: string) => void {
  const { workspaceId } = usePluginScope();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const hostsTaskSheet = useRouterState({
    select: (state) => routeHostsTaskSheet(state.matches.at(-1)?.routeId),
  });

  return useCallback(
    (taskId: string) => {
      if (hostsTaskSheet) {
        void navigate({ to: ".", search: { taskId } });
        return;
      }
      queryClient
        .fetchQuery({
          queryKey: ["task", taskId],
          queryFn: () => getTask(taskId),
        })
        .then((task) =>
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: { workspaceId, projectId: task.projectId, taskId },
          }),
        )
        .catch(() => {
          toast.error(t("common:plugins.openTaskFailed"));
        });
    },
    [hostsTaskSheet, navigate, queryClient, t, workspaceId],
  );
}
