import {
  type CollisionDetection,
  closestCorners,
  pointerWithin,
} from "@dnd-kit/core";
import type { ProjectWithTasks } from "@/types/project";

type ColumnData = {
  type?: string;
  column?: ProjectWithTasks["columns"][number];
};

export const boardCollisionDetection: CollisionDetection = (args) => {
  const { pointerCoordinates, droppableContainers, droppableRects } = args;
  if (!pointerCoordinates) return closestCorners(args);

  const [hit] = pointerWithin(args);
  const data = droppableContainers.find((container) => container.id === hit?.id)
    ?.data.current as ColumnData | undefined;
  if (data?.type !== "column" || !data.column?.tasks.length)
    return hit ? [hit] : [];

  let closest = hit;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const task of data.column.tasks) {
    const rect = droppableRects.get(task.id);
    if (!rect) continue;
    const distance = Math.abs(
      rect.top + rect.height / 2 - pointerCoordinates.y,
    );
    if (distance < closestDistance) {
      closest = { id: task.id };
      closestDistance = distance;
    }
  }
  return [closest];
};
