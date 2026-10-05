import {
  type CollisionDetection,
  closestCorners,
  pointerWithin,
} from "@dnd-kit/core";

export const boardCollisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCorners(args);
