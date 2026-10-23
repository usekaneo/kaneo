import type { GlobalBoardProject } from "@/fetchers/task/get-global-board-meta";
import type { GlobalBoardLane } from "./global-board-filters";

type ProjectColumn = GlobalBoardProject["columns"][number];

export type DropTarget =
  | { kind: "unchanged" }
  | { kind: "move"; column: ProjectColumn }
  | { kind: "choose"; columns: ProjectColumn[] }
  | { kind: "unavailable" };

/**
 * Picks the column in the task's own project that a drop on a global lane
 * means. Several candidates (In Progress and In Review both count as in
 * progress) are returned for the user to choose; none means the drop is
 * refused rather than guessed.
 */
export function resolveDropTarget(
  project: GlobalBoardProject | undefined,
  currentStatus: string,
  lane: GlobalBoardLane,
): DropTarget {
  if (!project || lane === "unmapped") return { kind: "unavailable" };
  const current = project.columns.find(
    (column) => column.slug === currentStatus,
  );
  if (current?.globalStatus === lane) return { kind: "unchanged" };

  const seen = new Set<string>();
  const columns = project.columns.filter((column) => {
    if (column.globalStatus !== lane || seen.has(column.slug)) return false;
    seen.add(column.slug);
    return true;
  });
  const [only] = columns;
  if (!only) return { kind: "unavailable" };
  return columns.length === 1
    ? { kind: "move", column: only }
    : { kind: "choose", columns };
}
