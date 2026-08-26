import { ChevronRight, GitFork, Network } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  buildTaskHierarchy,
  type TaskHierarchyNode,
} from "@/lib/build-task-hierarchy";
import { cn } from "@/lib/cn";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

type HierarchyViewProps = {
  project: ProjectWithTasks;
  tasks?: Task[];
  onOpenTask: (taskId: string) => void;
};

function HierarchyRow({
  node,
  depth,
  project,
  onOpenTask,
}: {
  node: TaskHierarchyNode;
  depth: number;
  project: ProjectWithTasks;
  onOpenTask: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const column = project.columns.find((item) => item.slug === node.task.status);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className="group flex min-h-10 items-center border-b border-border/60 hover:bg-accent/45"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        {hasChildren ? (
          <CollapsibleTrigger
            aria-label={
              open
                ? t("tasks:hierarchy.collapseTask", { title: node.task.title })
                : t("tasks:hierarchy.expandTask", { title: node.task.title })
            }
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronRight
              className={cn("size-4 transition-transform", open && "rotate-90")}
            />
          </CollapsibleTrigger>
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center text-border">
            <span className="size-1 rounded-full bg-current" />
          </span>
        )}

        <button
          type="button"
          onClick={() => onOpenTask(node.task.id)}
          className="flex min-w-0 flex-1 items-center gap-3 py-2 pr-4 text-left"
        >
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {project.slug}-{node.task.number}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {node.task.title}
          </span>
          {hasChildren && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <GitFork className="size-3.5" />
              {node.children.length}
            </span>
          )}
          <span className="hidden shrink-0 rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground sm:inline">
            {column?.name ?? node.task.status}
          </span>
          <span className="hidden w-32 shrink-0 truncate text-right text-xs text-muted-foreground md:block">
            {node.task.assigneeName ?? t("tasks:hierarchy.unassigned")}
          </span>
        </button>
      </div>

      {hasChildren && (
        <CollapsiblePanel>
          {node.children.map((child) => (
            <HierarchyRow
              key={`${node.task.id}-${child.task.id}`}
              node={child}
              depth={depth + 1}
              project={project}
              onOpenTask={onOpenTask}
            />
          ))}
        </CollapsiblePanel>
      )}
    </Collapsible>
  );
}

export default function HierarchyView({
  project,
  tasks: visibleTasks,
  onOpenTask,
}: HierarchyViewProps) {
  const { t } = useTranslation();
  const tasks = visibleTasks ?? [
    ...project.plannedTasks,
    ...project.columns.flatMap((column) => column.tasks),
  ];
  const roots = buildTaskHierarchy(tasks, project.subtaskRelations ?? []);

  if (roots.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <Network className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">{t("tasks:hierarchy.empty")}</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {t("tasks:hierarchy.emptyDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background p-3 sm:p-4">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-border bg-card">
        {roots.map((root) => (
          <HierarchyRow
            key={root.task.id}
            node={root}
            depth={0}
            project={project}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </div>
  );
}
