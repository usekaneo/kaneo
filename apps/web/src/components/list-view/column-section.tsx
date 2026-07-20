import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HierarchyMode } from "@/lib/build-task-hierarchy";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import type { TaskTreeNode } from "@/types/task";
import TaskRow from "./task-row";

type ColumnSectionProps = {
  column: ProjectWithTasks["columns"][number];
  projectSlug: string;
  hierarchyMode: HierarchyMode;
  tasks?: TaskTreeNode[];
  expandedSections: Record<string, boolean>;
  activeId: string | number | null;
  overColumnId: string | null;
  onToggleSection: (sectionId: string) => void;
  onAddTask: (columnId: string) => void;
  onArchiveClick: (column: ProjectWithTasks["columns"][number]) => void;
  onToggleExpand: (taskId: string) => void;
  isExpanded: (taskId: string) => boolean;
};

export default function ColumnSection({
  column,
  projectSlug,
  hierarchyMode,
  tasks,
  expandedSections,
  activeId,
  overColumnId,
  onToggleSection,
  onAddTask,
  onArchiveClick,
  onToggleExpand,
  isExpanded,
}: ColumnSectionProps) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "column",
      column,
    },
  });

  const showDropIndicator = activeId && overColumnId === column.id;
  const visibleTasks = tasks ?? column.tasks;
  const isNested = hierarchyMode === "nested";

  const renderTaskRow = (task: Task | TaskTreeNode) => {
    const treeNode = isNested ? (task as TaskTreeNode) : null;

    return (
      <TaskRow
        key={task.id}
        task={task}
        projectSlug={projectSlug}
        depth={treeNode?.depth ?? 0}
        hasChildren={treeNode?.hasChildren ?? false}
        isExpanded={isExpanded(task.id)}
        onToggleExpand={() => onToggleExpand(task.id)}
        parentTitle={treeNode?.parentTitle}
        parentId={task.parentId}
        showParentBadge={
          isNested &&
          !!treeNode?.parentId &&
          !treeNode.parentInSameColumn &&
          (treeNode.depth ?? 0) === 0
        }
        hierarchyMode={hierarchyMode}
      />
    );
  };

  return (
    <div
      className={cn(
        "border-b border-border/50 transition-colors duration-150 overflow-auto",
        showDropIndicator && "border-l-4 border-l-ring bg-accent/35",
      )}
    >
      <div className="flex items-center justify-between py-2 px-4 bg-muted/60 border-b border-border/50">
        <button
          type="button"
          onClick={() => onToggleSection(column.id)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 transition-transform",
              expandedSections[column.id] && "rotate-90",
            )}
          />
          <div className="flex items-center gap-2 h-4">
            {getColumnIcon(column.id, column.isFinal, column.icon)}
            <div className="flex items-center gap-1">
              <span className="mt-1 mr-1">{column.name}</span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {visibleTasks.length}
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title={t("tasks:listView.addTask")}
          >
            <Plus className="w-3 h-3" />
          </button>

          {column.isFinal && visibleTasks.length > 0 && (
            <button
              type="button"
              onClick={() => onArchiveClick(column)}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title={t("tasks:listView.archiveAllTooltip")}
            >
              <Archive className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {expandedSections[column.id] && (
        <div
          ref={setNodeRef}
          className="bg-card transition-[translate,opacity] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
        >
          <SortableContext
            items={visibleTasks}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visibleTasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                >
                  {renderTaskRow(task)}
                </motion.div>
              ))}
            </AnimatePresence>
          </SortableContext>

          {visibleTasks.length === 0 && (
            <div className="py-6 px-4 text-center text-xs text-muted-foreground">
              {t("tasks:listView.noTasks")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
