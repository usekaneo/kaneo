import {
  SortableContext,
  type SortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ProjectWithTasks } from "@/types/project";
import TaskCard from "../task-card";

const keepOrder: SortingStrategy = () => null;

const CARD_ENTER = { type: "spring", duration: 0.3, bounce: 0 } as const;
const CARD_EXIT = { duration: 0.15, ease: [0.23, 1, 0.32, 1] } as const;

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
  const hidden = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, transform: "scale(0.98)" };
  const shown = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, transform: "scale(1)" };

  return (
    <SortableContext
      items={column.tasks}
      strategy={disableSorting ? keepOrder : verticalListSortingStrategy}
    >
      <div className="flex flex-col gap-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {column.tasks.map((task) => (
            <motion.div
              key={task.id}
              initial={task.id === activeTaskId ? false : hidden}
              animate={shown}
              exit={
                task.id === activeTaskId
                  ? undefined
                  : { ...hidden, transition: CARD_EXIT }
              }
              transition={CARD_ENTER}
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
