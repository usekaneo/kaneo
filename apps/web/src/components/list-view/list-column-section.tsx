import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ChevronRight, Plus } from "lucide-react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { EASE_OUT } from "@/lib/motion";
import type { SubtaskRow } from "@/lib/subtask-tree";
import type { ProjectWithTasks } from "@/types/project";
import TaskRow from "./task-row";

type Column = ProjectWithTasks["columns"][number];
type ColumnTask = Column["tasks"][number];

type ListColumnSectionProps = {
  column: Column;
  projectSlug: string;
  isExpanded: boolean;
  showDropIndicator: boolean;
  disableCollectionActions: boolean;
  onToggle: (columnId: string) => void;
  onAddTask: (columnId: string) => void;
  onArchive: (column: Column) => void;
  /**
   * The section's rows in display order. A subtask keeps its own row and is
   * repeated, indented, beneath each expanded parent.
   */
  rows: SubtaskRow<ColumnTask>[];
  onToggleTaskExpanded: (rowId: string) => void;
  relationsLoading: boolean;
  draggingTaskId: string | null;
};

const ListColumnSection = memo(function ListColumnSection({
  column,
  projectSlug,
  isExpanded,
  showDropIndicator,
  disableCollectionActions,
  onToggle,
  onAddTask,
  onArchive,
  rows,
  onToggleTaskExpanded,
  relationsLoading,
  draggingTaskId,
}: ListColumnSectionProps) {
  const { t } = useTranslation();
  const [animateExpand, setAnimateExpand] = useState(false);
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: "column", column },
  });

  // Reserving the toggle column on every row keeps the titles aligned, but
  // only where the group actually has subtasks. Until the relations arrive,
  // every task looks childless; holding the column open means the chevrons
  // appear in place instead of shifting every title sideways.
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
          onClick={() => {
            setAnimateExpand(true);
            onToggle(column.id);
          }}
          aria-expanded={isExpanded}
          className="touch-hitbox relative flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 transition-transform duration-150 ease-out",
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

        <div className="flex items-center gap-1 pointer-coarse:gap-6">
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            className="touch-hitbox relative p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
            title={t("tasks:listView.addTask")}
            aria-label={t("tasks:listView.addTask")}
          >
            <Plus className="w-3 h-3" />
          </button>

          {column.isFinal && column.tasks.length > 0 && (
            <button
              type="button"
              disabled={disableCollectionActions}
              onClick={() => onArchive(column)}
              className="touch-hitbox relative p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title={t("tasks:listView.archiveAllTooltip")}
              aria-label={t("tasks:listView.archiveAllTooltip")}
            >
              <Archive className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div
          ref={setNodeRef}
          className={cn(
            "bg-card",
            animateExpand &&
              "transition-[translate,opacity] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0",
          )}
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
                  transition={{ duration: 0.15, ease: EASE_OUT }}
                >
                  <TaskRow
                    task={row.task}
                    projectSlug={projectSlug}
                    depth={row.depth}
                    rowId={row.rowId}
                    childCount={row.childCount}
                    isExpanded={row.isExpanded}
                    onToggleExpanded={onToggleTaskExpanded}
                    reserveToggleSpace={groupHasSubtasks}
                    isTaskDragging={draggingTaskId === row.task.id}
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
});

export default ListColumnSection;
