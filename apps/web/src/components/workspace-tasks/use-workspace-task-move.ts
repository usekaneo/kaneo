import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type {
  WorkspaceBoard,
  WorkspaceBoardQuery,
} from "@/fetchers/task/get-workspace-board";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { workspaceBoardQueryKey } from "@/hooks/queries/task/use-get-workspace-board";
import type { BoardColumn, BoardTask } from "@/lib/board-task";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import { moveWorkspaceTask } from "./move-workspace-task";

/**
 * Move a task on the workspace board by changing its status. The card moves
 * at once when the board is cached; while the first load is still running the
 * change goes out anyway and lands when the load settles.
 */
export function useWorkspaceTaskMove(
  workspaceId: string,
  serverQuery: WorkspaceBoardQuery,
  board: WorkspaceBoard | undefined,
) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setProject = useProjectStore((state) => state.setProject);
  const { mutate: updateTaskStatus } = useUpdateTaskStatus();

  return (task: BoardTask, column: BoardColumn) => {
    const owner = board?.projects.find(
      (project) => project.id === task.projectId,
    );
    if (!owner?.columnSlugs.includes(column.slug)) {
      toast.error(
        t("workspace:tasks.moveNotAvailable", {
          project: task.projectName ?? owner?.name ?? task.projectSlug ?? "",
          column: column.name,
        }),
      );
      return;
    }

    const queryKey = workspaceBoardQueryKey(workspaceId, serverQuery);
    const previous = queryClient.getQueryData<WorkspaceBoard>(queryKey);
    let optimistic: WorkspaceBoard | undefined;
    if (previous) {
      // A poll still in flight would otherwise land on top of the move. It is
      // dropped without rolling back, so the card moves in this same tick and
      // the drop animation lands on its new place instead of the old one.
      void queryClient.cancelQueries(
        { queryKey, exact: true },
        { revert: false },
      );
      // The cache stores a structurally shared copy; keep that one so the
      // rollback can tell whether anything changed the board since.
      optimistic = queryClient.setQueryData<WorkspaceBoard>(
        queryKey,
        moveWorkspaceTask(previous, task.id, column.id),
      );
      if (optimistic) setProject(optimistic);
    }

    updateTaskStatus(
      { ...task, status: column.slug },
      {
        onError: () => {
          if (
            previous &&
            optimistic &&
            queryClient.getQueryData(queryKey) === optimistic
          ) {
            queryClient.setQueryData(queryKey, previous);
            setProject(previous);
          }
          toast.error(t("workspace:tasks.moveFailed"));
          void queryClient.invalidateQueries({
            queryKey: workspaceBoardQueryKey(workspaceId),
          });
        },
      },
    );
  };
}
