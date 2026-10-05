import {
  type CollisionDetection,
  closestCorners,
  pointerWithin,
} from "@dnd-kit/core";
import type { ProjectWithTasks } from "@/types/project";

const COLUMN_GAP = 16;

type ColumnData = {
  type?: string;
  column?: ProjectWithTasks["columns"][number];
};

export const boardCollisionDetection: CollisionDetection = (args) => {
  const {
    pointerCoordinates: pointer,
    droppableContainers,
    droppableRects,
  } = args;
  if (!pointer) return closestCorners(args);

  const [hit] = pointerWithin(args);
  const target = hit
    ? droppableContainers.find((container) => container.id === hit.id)
    : droppableContainers.find((container) => {
        const rect = droppableRects.get(container.id);
        return (
          (container.data.current as ColumnData | undefined)?.type ===
            "column" &&
          rect !== undefined &&
          pointer.y >= rect.top &&
          pointer.y <= rect.bottom &&
          pointer.x >= rect.left - COLUMN_GAP &&
          pointer.x <= rect.right + COLUMN_GAP
        );
      });
  if (!target) return [];

  const data = target.data.current as ColumnData | undefined;
  if (data?.type !== "column" || !data.column?.tasks.length)
    return [{ id: target.id }];

  let closest: { id: string | number } = { id: target.id };
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const task of data.column.tasks) {
    const rect = droppableRects.get(task.id);
    if (!rect) continue;
    const distance = Math.abs(rect.top + rect.height / 2 - pointer.y);
    if (distance < closestDistance) {
      closest = { id: task.id };
      closestDistance = distance;
    }
  }
  return [closest];
};
