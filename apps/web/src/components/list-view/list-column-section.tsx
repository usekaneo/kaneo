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
import type { ProjectWithTasks } from "@/types/project";
import TaskRow from "./task-row";

type Column = ProjectWithTasks["columns"][number];

type ListColumnSectionProps = {
  column: Column;
  projectSlug: string;
  isExpanded: boolean;
  showDropIndicator: boolean;
  disableCollectionActions: boolean;
  onToggle: (columnId: string) => void;
  onAddTask: (columnId: string) => void;
  onArchive: (column: Column) => void;
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
}: ListColumnSectionProps) {
  const { t } = useTranslation();
  const [animateExpand, setAnimateExpand] = useState(false);
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: "column", column },
  });

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
          <SortableContext
            items={column.tasks}
            strategy={verticalListSortingStrategy}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {column.tasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: EASE_OUT }}
                >
                  <TaskRow task={task} projectSlug={projectSlug} />
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
