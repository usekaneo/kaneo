import type { Column } from "../api/schemas.js";
import { matchColumn } from "./match-column.js";

export const BACKLOG_STATUS = "planned";

export function backlogColumn(projectId: string): Column {
  return {
    id: BACKLOG_STATUS,
    projectId,
    name: "Backlog",
    slug: BACKLOG_STATUS,
    position: -1,
    color: null,
    isFinal: false,
  };
}

export function statusTargets(
  columns: ReadonlyArray<Column>,
  projectId: string,
): ReadonlyArray<Column> {
  return columns.some((column) => column.slug === BACKLOG_STATUS)
    ? columns
    : [...columns, backlogColumn(projectId)];
}

// the backlog is a task status, not a column, so real columns win any tie.
export function matchStatus(
  columns: ReadonlyArray<Column>,
  reference: string,
): Column | undefined {
  const backlog = backlogColumn(columns[0]?.projectId ?? "");
  const match = matchColumn(columns, reference);
  if (match || !matchColumn([backlog], reference)) return match;
  return columns.find((column) => column.slug === BACKLOG_STATUS) ?? backlog;
}
