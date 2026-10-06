import {
  type CollisionDetection,
  closestCorners,
  type DroppableContainer,
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

  let column: DroppableContainer | undefined;
  let columnDistance = COLUMN_GAP;
  for (const container of droppableContainers) {
    if ((container.data.current as ColumnData | undefined)?.type !== "column")
      continue;
    const rect = droppableRects.get(container.id);
    if (!rect || pointer.y < rect.top || pointer.y > rect.bottom) continue;
    const distance = Math.max(rect.left - pointer.x, pointer.x - rect.right, 0);
    if (distance < columnDistance) {
      column = container;
      columnDistance = distance;
    }
  }
  const columnRect = column && droppableRects.get(column.id);
  if (!column || !columnRect) return [];

  let closest: { id: string | number } = { id: column.id };
  let closestDistance = Number.POSITIVE_INFINITY;
  const tasks =
    (column.data.current as ColumnData | undefined)?.column?.tasks ?? [];
  for (const task of tasks) {
    const rect = droppableRects.get(task.id);
    if (!rect || rect.bottom < columnRect.top || rect.top > columnRect.bottom)
      continue;
    const distance =
      pointer.y >= rect.top && pointer.y <= rect.bottom
        ? 0
        : Math.abs(rect.top + rect.height / 2 - pointer.y);
    if (distance < closestDistance) {
      closest = { id: task.id };
      closestDistance = distance;
    }
  }
  return [closest];
};
