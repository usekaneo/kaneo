import type { GlobalBoardTasksQuery } from "@/fetchers/task/get-global-board-tasks";

export type GlobalBoardLane = GlobalBoardTasksQuery["globalStatus"];

export type GlobalBoardFilters = Omit<
  GlobalBoardTasksQuery,
  "globalStatus" | "page" | "limit"
>;

export const GLOBAL_BOARD_LANES = [
  "to-do",
  "in-progress",
  "done",
] as const satisfies readonly GlobalBoardLane[];

const FILTER_KEYS = [
  "workspaceId",
  "projectId",
  "assigneeId",
  "priority",
  "label",
  "q",
] as const;

const PRIORITIES = new Set(["no-priority", "low", "medium", "high", "urgent"]);

// Route search params arrive untyped; keep only non-empty known filters.
export function parseGlobalBoardFilters(
  search: Record<string, unknown>,
): GlobalBoardFilters {
  const filters: Record<string, string> = {};
  for (const key of FILTER_KEYS) {
    const value = search[key];
    if (typeof value === "string" && value.trim()) filters[key] = value;
  }
  if (filters.priority && !PRIORITIES.has(filters.priority))
    delete filters.priority;
  return filters as GlobalBoardFilters;
}
