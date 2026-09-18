import { useTranslation } from "react-i18next";
import CircularProgress from "@/components/ui/circular-progress";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetTaskRelations from "@/hooks/queries/task-relation/use-get-task-relations";
import { cn } from "@/lib/cn";

// The parent task's overall progress: subtasks in a final column out of all
// subtasks, across every checklist. Shown once, next to the task id; each
// checklist keeps its own count.
export default function TaskProgress({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { data: relations = [] } = useGetTaskRelations(taskId);
  const { data: columns = [] } = useGetColumns(projectId);

  const subtasks = relations.filter(
    (rel) =>
      rel.relationType === "subtask" &&
      rel.sourceTaskId === taskId &&
      rel.targetTask,
  );
  if (subtasks.length === 0) return null;

  const finals = new Set(columns.filter((c) => c.isFinal).map((c) => c.slug));
  const done = subtasks.filter((rel) =>
    columns.length > 0
      ? finals.has(rel.targetTask?.status ?? "")
      : rel.targetTask?.status === "done",
  ).length;
  const total = subtasks.length;
  const complete = done === total;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs tabular-nums",
        complete
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border text-muted-foreground",
      )}
      title={t("tasks:progress.hint", { done, total })}
    >
      <CircularProgress completed={done} total={total} size={14} />
      {t("tasks:progress.label", {
        done,
        total,
        percent: Math.round((done / total) * 100),
      })}
    </span>
  );
}
