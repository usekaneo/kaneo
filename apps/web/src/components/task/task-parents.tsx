import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useDeleteTaskRelation from "@/hooks/mutations/task-relation/use-delete-task-relation";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

export default function TaskParents({
  taskId,
  workspaceId,
}: {
  taskId: string;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: relations = [], isError } = useGetTaskRelations(taskId);
  const deleteRelation = useDeleteTaskRelation(taskId);
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const parents = relations.filter(
    (relation) =>
      relation.relationType === "subtask" && relation.targetTaskId === taskId,
  );

  const handleRemove = async (id: string) => {
    try {
      await deleteRelation.mutateAsync(id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:subtasks.unlinkError"),
      );
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {isError && (
        <p role="alert" className="text-xs text-destructive">
          {t("tasks:subtasks.loadError")}
        </p>
      )}
      {parents.map(({ id, sourceTask }) =>
        sourceTask ? (
          <div key={id} className="flex items-center gap-1">
            <button
              type="button"
              className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() =>
                navigate({
                  to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
                  params: {
                    workspaceId,
                    projectId: sourceTask.projectId,
                    taskId: sourceTask.id,
                  },
                })
              }
            >
              <ArrowUpRight className="size-3 shrink-0" />
              <span className="truncate">
                {t("tasks:detail.subtaskOf")}{" "}
                <span className="font-medium">{sourceTask.title}</span>
              </span>
            </button>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon-xs"
                title={t("tasks:subtasks.unlink")}
                aria-label={t("tasks:subtasks.removeParent", {
                  title: sourceTask.title,
                })}
                disabled={deleteRelation.isPending}
                onClick={() => void handleRemove(id)}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        ) : null,
      )}
    </div>
  );
}
