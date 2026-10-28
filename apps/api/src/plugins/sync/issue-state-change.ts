import { isTaskInFinalState } from "../github/services/task-service";
import { isStateSyncPaused } from "./state-sync-paused";

// Archiving keeps the issue's current state: a completed task's issue stays
// closed, and shelving unfinished work does not close it. Unarchiving into an
// open column reopens the issue in case the task was completed before.
export async function resolveIssueStateChange(
  projectId: string,
  oldStatus: string,
  status: string,
): Promise<"close" | "reopen" | undefined> {
  if (isStateSyncPaused(status)) return;
  if (await isTaskInFinalState({ projectId, status, columnId: null }))
    return "close";
  if (
    isStateSyncPaused(oldStatus) ||
    (await isTaskInFinalState({ projectId, status: oldStatus, columnId: null }))
  )
    return "reopen";
}
