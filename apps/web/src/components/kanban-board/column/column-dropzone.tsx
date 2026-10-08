import {
  SortableContext,
  type SortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ProjectWithTasks } from "@/types/project";
import TaskCard from "../task-card";

const keepOrder: SortingStrategy = () => null;

type ColumnDropzoneProps = {
  column: ProjectWithTasks["columns"][number];
  activeTaskId: string | null;
  disableDragDrop?: boolean;
  disableSorting?: boolean;
};

export function ColumnDropzone({
  column,
  activeTaskId,
  disableDragDrop = false,
  disableSorting = false,
}: ColumnDropzoneProps) {
  const reduceMotion = useReducedMotion();
  const hidden = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 };

  return (
    <SortableContext
      items={column.tasks}
      strategy={disableSorting ? keepOrder : verticalListSortingStrategy}
    >
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {column.tasks.map((task) => (
            <motion.div
              key={task.id}
              initial={task.id === activeTaskId ? false : hidden}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={task.id === activeTaskId ? undefined : hidden}
              transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
            >
              <TaskCard
                task={task}
                disableDragDrop={disableDragDrop}
                isFinalColumn={column.isFinal}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </SortableContext>
  );
}
