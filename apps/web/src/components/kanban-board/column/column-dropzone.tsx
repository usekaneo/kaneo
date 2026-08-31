import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, type RefObject, useEffect } from "react";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import TaskCard from "../task-card";

type VirtualTaskRowProps = {
  task: Task;
  index: number;
  start: number;
  disableDragDrop: boolean;
  measureElement: (node: Element | null) => void;
};

const VirtualTaskRow = memo(function VirtualTaskRow({
  task,
  index,
  start,
  disableDragDrop,
  measureElement,
}: VirtualTaskRowProps) {
  return (
    <div
      ref={measureElement}
      data-index={index}
      className="absolute top-0 left-0 w-full"
      style={{
        transform: `translateY(${start}px)`,
      }}
    >
      <TaskCard task={task} disableDragDrop={disableDragDrop} />
    </div>
  );
});

type ColumnDropzoneProps = {
  column: ProjectWithTasks["columns"][number];
  disableDragDrop?: boolean;
  onIsOverChange?: (isOver: boolean) => void;
  scrollElementRef: RefObject<HTMLDivElement | null>;
};

export function ColumnDropzone({
  column,
  disableDragDrop = false,
  onIsOverChange,
  scrollElementRef,
}: ColumnDropzoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: {
      type: "column",
      column,
    },
  });

  const taskVirtualizer = useVirtualizer({
    count: column.tasks.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 132,
    initialRect: { width: 384, height: 800 },
    getItemKey: (index) => column.tasks[index]?.id ?? index,
    gap: 8,
    overscan: 5,
  });

  useEffect(() => {
    onIsOverChange?.(isOver);
  }, [isOver, onIsOverChange]);

  return (
    <div ref={setNodeRef} className="min-h-full">
      <SortableContext
        items={column.tasks}
        strategy={verticalListSortingStrategy}
      >
        <div
          className="relative w-full"
          style={{
            height: `${taskVirtualizer.getTotalSize()}px`,
          }}
        >
          {taskVirtualizer.getVirtualItems().map((virtualTask) => {
            const task = column.tasks[virtualTask.index];
            if (!task) return null;

            return (
              <VirtualTaskRow
                key={virtualTask.key}
                task={task}
                index={virtualTask.index}
                start={virtualTask.start}
                disableDragDrop={disableDragDrop}
                measureElement={taskVirtualizer.measureElement}
              />
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}
