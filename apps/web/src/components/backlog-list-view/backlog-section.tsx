import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, type Clock, Plus } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";
import BacklogTaskRow from "./backlog-task-row";

const BacklogSection = memo(function BacklogSection({
  sectionId,
  title,
  icon: IconComponent,
  tasks,
  isExpanded,
  showDropIndicator,
  onToggle,
  onAddTask,
}: {
  sectionId: string;
  title: string;
  icon: typeof Clock;
  tasks: Task[];
  isExpanded: boolean;
  showDropIndicator: boolean;
  onToggle: (sectionId: string) => void;
  onAddTask?: () => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({
    id: sectionId,
    data: {
      type: "column",
      column: { id: sectionId, name: title },
    },
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
          onClick={() => onToggle(sectionId)}
          aria-expanded={isExpanded}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
          <div className="flex items-center gap-2 h-4">
            <IconComponent className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            <div className="flex items-center gap-1">
              <span className="mt-1 mr-1">
                {t(`tasks:backlog.sections.${sectionId}`, {
                  defaultValue: title,
                })}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">
                {tasks.length}
              </span>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-1">
          {onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title={t("tasks:backlog.addTask")}
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div
          ref={setNodeRef}
          className="bg-card transition-[translate,opacity] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
        >
          <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
            <AnimatePresence initial={false} mode="popLayout">
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                >
                  <BacklogTaskRow task={task} />
                </motion.div>
              ))}
            </AnimatePresence>
          </SortableContext>

          {tasks.length === 0 && (
            <div className="py-6 px-4 text-center text-xs text-muted-foreground">
              {t("tasks:backlog.noTasksInSection", {
                section: t(`tasks:backlog.sections.${sectionId}`, {
                  defaultValue: title,
                }).toLowerCase(),
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default BacklogSection;
