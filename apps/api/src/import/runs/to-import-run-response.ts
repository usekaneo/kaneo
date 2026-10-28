import type { ImportSourceId } from "@kaneo/importers";
import type { importRunTable } from "../../database/schema";
import {
  failUnfinishedProjects,
  IMPORT_RUN_STATUSES,
  type ImportRunStatus,
} from "../import-run-project";
import type { ImportRunResponse } from "../response";

export type ImportRunRow = typeof importRunTable.$inferSelect;

export const STALE_RUN_MS = 2 * 60_000;

export const INTERRUPTED_RUN_ERROR =
  "The import was interrupted before it finished.";

export function isStaleRun(
  row: Pick<ImportRunRow, "status" | "heartbeatAt">,
  now: Date,
) {
  return (
    row.status === "running" &&
    now.getTime() - row.heartbeatAt.getTime() > STALE_RUN_MS
  );
}

function runStatus(status: string): ImportRunStatus {
  return (IMPORT_RUN_STATUSES as readonly string[]).includes(status)
    ? (status as ImportRunStatus)
    : "failed";
}

export function interruptedRun(row: ImportRunRow) {
  return {
    status: "failed" as const,
    message: null,
    error: INTERRUPTED_RUN_ERROR,
    projects: failUnfinishedProjects(row.projects, INTERRUPTED_RUN_ERROR),
    finishedAt: row.heartbeatAt,
  };
}

export function toImportRunResponse(
  row: ImportRunRow,
  now = new Date(),
): ImportRunResponse {
  const current = isStaleRun(row, now)
    ? { ...row, ...interruptedRun(row) }
    : row;

  return {
    id: current.id,
    workspaceId: current.workspaceId,
    source: current.source as ImportSourceId,
    status: runStatus(current.status),
    includeComments: current.includeComments,
    message: current.message,
    error: current.error,
    projects: current.projects,
    createdAt: current.createdAt,
    finishedAt: current.finishedAt,
  };
}
