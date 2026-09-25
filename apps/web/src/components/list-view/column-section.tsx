import { type UniqueIdentifier, useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ChevronRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { flattenSubtaskRows } from "@/lib/subtask-tree";
import type { ProjectWithTasks } from "@/types/project";
import TaskRow from "./task-row";

type Column = ProjectWithTasks["columns"][number];

type ColumnSectionProps = {
  column: Column;
  projectSlug: string;
  activeId: UniqueIdentifier | null;
  overColumnId: string | null;
  isExpanded: boolean;
  expandedTasks: Record<string, boolean>;
  subtaskChildren: Map<string, string[]>;
  tasksById: Map<string, Column["tasks"][number]>;
  relationsLoading: boolean;
  toggleSection: (columnId: string) => void;
  toggleTaskExpanded: (rowId: string) => void;
  onAddTask: (columnId: string) => void;
  handleArchiveClick: (column: Column) => void;
};

// Keep the component identity stable so list updates preserve focus and drag state.
export default function ColumnSection({
  column,
  projectSlug,
  activeId,
  overColumnId,
  isExpanded,
  expandedTasks,
  subtaskChildren,
  tasksById,
  relationsLoading,
  toggleSection,
  toggleTaskExpanded,
  onAddTask,
  handleArchiveClick,
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

  // A dragged parent collapses for the duration: moving a row while its
  // children are rendered beneath it has no single correct outcome, and
  // hiding them keeps the drag to the one row the user grabbed.
  // Reserving the toggle column on every row keeps the titles aligned, but
  // only where the group actually has subtasks; a project without any keeps
  // the original left edge.
  const rows = flattenSubtaskRows({
    tasks: column.tasks,
    children: subtaskChildren,
    tasksById,
    // Nothing stays expanded while a drag is in flight. Nested repeats are
    // not in the SortableContext, so they never receive the transforms
    // applied to the top-level rows: dragging any task past an expanded
    // parent would slide the parent while its children stayed put, and the
    // subtree would visibly split. Collapsing happens once, as the drag
    // starts, rather than shifting rows under a moving pointer.
    isExpanded: (rowId) => !activeId && Boolean(expandedTasks[rowId]),
  });

  // Until the relations arrive, every task looks childless. Holding the
  // toggle column open means the chevrons appear in place instead of
  // shifting every title sideways, and aria-busy below says the region is
  // still resolving rather than settled and flat.
  const groupHasSubtasks =
    relationsLoading || rows.some((row) => row.childCount > 0 || row.depth > 0);

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
          onClick={() => toggleSection(column.id)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
          <div className="flex items-center gap-2 h-4">
            {getColumnIcon(column.id, column.isFinal, column.icon)}
            <div className="flex items-center gap-1">
              <span className="mt-1 mr-1">{column.name}</span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {column.tasks.length}
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onAddTask(column.id);
            }}
            className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title={t("tasks:listView.addTask")}
          >
            <Plus className="w-3 h-3" />
          </button>

          {column.isFinal && column.tasks.length > 0 && (
            <button
              type="button"
              onClick={() => handleArchiveClick(column)}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title={t("tasks:listView.archiveAllTooltip")}
            >
              <Archive className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div
          ref={setNodeRef}
          className="bg-card transition-[translate,opacity] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
        >
          {/* Only the top-level rows are sortable; the nested repeats share
              their task id with one of them. */}
          <SortableContext
            items={column.tasks}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {rows.map((row) => (
                <motion.div
                  key={row.rowId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                >
                  <TaskRow
                    task={row.task}
                    projectSlug={projectSlug}
                    reserveToggleSpace={groupHasSubtasks}
                    isTaskDragging={activeId === row.task.id}
                    depth={row.depth}
                    rowId={row.rowId}
                    childCount={row.childCount}
                    isExpanded={row.isExpanded}
                    onToggleExpanded={() => toggleTaskExpanded(row.rowId)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </SortableContext>

          {column.tasks.length === 0 && (
            <div className="py-6 px-4 text-center text-xs text-muted-foreground">
              {t("tasks:listView.noTasks")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
