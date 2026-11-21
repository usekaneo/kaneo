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

// the backlog is a task status, not a column, so real columns win any tie.
export function matchStatus(
  columns: ReadonlyArray<Column>,
  reference: string,
): Column | undefined {
  return (
    matchColumn(columns, reference) ??
    matchColumn([backlogColumn(columns[0]?.projectId ?? "")], reference)
  );
}
