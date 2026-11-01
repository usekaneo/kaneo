import {
  defaultRangeExtractor,
  type Range,
  useVirtualizer,
} from "@tanstack/react-virtual";
import { useEffect } from "react";
import { focusTaskElement } from "@/components/project/task-view-keys/focus-task-element";
import useBulkSelectionStore from "@/store/bulk-selection";
import type { ProjectWithTasks } from "@/types/project";
import TaskCard from "../task-card";

const CARD_ESTIMATE = 92;
const CARD_GAP = 6;

type VirtualCardListProps = {
  column: ProjectWithTasks["columns"][number];
  activeTaskId: string | null;
  disableDragDrop: boolean;
  scrollElement: HTMLDivElement | null;
};

export function VirtualCardList({
  column,
  activeTaskId,
  disableDragDrop,
  scrollElement,
}: VirtualCardListProps) {
  "use no memo";
  const tasks = column.tasks;
  const activeIndex = activeTaskId
    ? tasks.findIndex((task) => task.id === activeTaskId)
    : -1;
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => CARD_ESTIMATE,
    gap: CARD_GAP,
    overscan: 8,
    getItemKey: (index) => tasks[index].id,
    rangeExtractor: (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      return activeIndex < 0 || indexes.includes(activeIndex)
        ? indexes
        : [...indexes, activeIndex].sort((a, b) => a - b);
    },
  });

  const focusedTaskId = useBulkSelectionStore((state) => state.focusedTaskId);
  const focusedIndex = focusedTaskId
    ? tasks.findIndex((task) => task.id === focusedTaskId)
    : -1;

  useEffect(() => {
    if (!focusedTaskId || focusedIndex < 0) return;
    if (document.querySelector(`[data-task-id="${focusedTaskId}"]`)) return;
    virtualizer.scrollToIndex(focusedIndex, { align: "auto" });
    const frame = requestAnimationFrame(() =>
      focusTaskElement(focusedTaskId, true),
    );
    return () => cancelAnimationFrame(frame);
  }, [focusedTaskId, focusedIndex, virtualizer]);

  return (
    <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => (
        <div
          key={item.key}
          ref={virtualizer.measureElement}
          data-index={item.index}
          className="absolute inset-x-0 top-0"
          style={{ transform: `translateY(${item.start}px)` }}
        >
          <TaskCard
            task={tasks[item.index]}
            disableDragDrop={disableDragDrop}
            isFinalColumn={column.isFinal}
          />
        </div>
      ))}
    </div>
  );
}
