import {
  SortableContext,
  type SortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AnimatePresence, useReducedMotion } from "motion/react";
import { memo } from "react";
import type { ProjectWithTasks } from "@/types/project";
import DropzoneCard from "./dropzone-card";
import { VirtualCardList } from "./virtual-card-list";

const keepOrder: SortingStrategy = () => null;
const VIRTUALIZE_AFTER = 40;

type ColumnDropzoneProps = {
  column: ProjectWithTasks["columns"][number];
  activeTaskId: string | null;
  disableDragDrop?: boolean;
  disableSorting?: boolean;
  animateEntries?: boolean;
  scrollElement: HTMLDivElement | null;
};

function ColumnDropzone({
  column,
  activeTaskId,
  disableDragDrop = false,
  disableSorting = false,
  animateEntries = true,
  scrollElement,
}: ColumnDropzoneProps) {
  const reduceMotion = Boolean(useReducedMotion());

  return (
    <SortableContext
      items={column.tasks}
      strategy={disableSorting ? keepOrder : verticalListSortingStrategy}
    >
      {column.tasks.length > VIRTUALIZE_AFTER ? (
        <VirtualCardList
          column={column}
          activeTaskId={activeTaskId}
          disableDragDrop={disableDragDrop}
          scrollElement={scrollElement}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          <AnimatePresence initial={false} mode="popLayout">
            {column.tasks.map((task) => (
              <DropzoneCard
                key={task.id}
                task={task}
                isActive={task.id === activeTaskId}
                animateEntry={animateEntries}
                reduceMotion={reduceMotion}
                disableDragDrop={disableDragDrop}
                isFinalColumn={column.isFinal}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </SortableContext>
  );
}

export default memo(ColumnDropzone);
