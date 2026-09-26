// Pure geometry for "drag to create a dependency": given the pointer's
// current position and every candidate task bar's pixel box (the same boxes
// the dependency-line overlay itself measures — see gantt.tsx's `taskBoxes`),
// decide which bar (if any) the gesture would link to. Kept free of the DOM
// and of React so the hit-testing is unit-testable without rendering
// anything, the same reasoning as dependency-lines.ts.

import type { TaskBarBox } from "./dependency-lines";

export type LinkDropCandidate = {
  taskId: string;
  box: TaskBarBox;
};

export type Point = { x: number; y: number };

// Where a link-drag's preview line leaves the source bar: its right (finish)
// edge, vertically centered — the same anchor a finish-to-start dependency
// line uses (see anchorSides/verticalCenter in dependency-lines.ts). Every
// link created by this gesture defaults to "fs" (see gantt.tsx), so the
// preview should leave from the same point that edge will actually render
// from once created.
export function linkSourceAnchorPoint(box: TaskBarBox): Point {
  return { x: box.right, y: box.top + box.height / 2 };
}

function pointInsideBox(point: Point, box: TaskBarBox): boolean {
  return (
    point.x >= box.left &&
    point.x <= box.right &&
    point.y >= box.top &&
    point.y <= box.top + box.height
  );
}

// The task id a link-drag released at `point` would target, or null when it
// should cancel instead (dropped on empty space, or back on the source bar
// itself — a self-link is never allowed). `candidates` should already be
// narrowed to the bars this gesture is allowed to land on (this project's own
// rows; see gantt.tsx) — an external, read-only row simply isn't included.
// When boxes overlap, the first matching candidate wins; callers pass them in
// the same order they're drawn, so this reads as "the topmost bar under the
// pointer" in practice.
export function findLinkDropTarget(
  point: Point,
  candidates: readonly LinkDropCandidate[],
  sourceTaskId: string,
): string | null {
  for (const candidate of candidates) {
    if (candidate.taskId === sourceTaskId) continue;
    if (pointInsideBox(point, candidate.box)) return candidate.taskId;
  }
  return null;
}
