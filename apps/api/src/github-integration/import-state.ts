export type GitHubImportNotification =
  | {
      type: "task.updated" | "task.labels_updated" | "comment.updated";
      taskId: string;
    }
  | { type: "project.updated" };

export type GitHubImportState = {
  phase: "issues" | "labels" | "comments" | "pulls" | "complete";
  repositoryId: number;
  startedAt: string;
  issueCursor: string | null;
  pullCursor: string | null;
  moreIssues: boolean;
  currentIssue: {
    number: number;
    taskId: string;
    isNewTask?: boolean;
    labelCursor: string | null;
    commentCursor: string | null;
    moreComments: boolean;
    labelsRemaining: number;
    commentsRemaining: number;
    statusSeen: boolean;
    prioritySeen: boolean;
  } | null;
  imported: number;
  updated: number;
  skipped: number;
  // Optional for runs saved before notification delivery became durable.
  pendingNotifications?: GitHubImportNotification[];
};

export function initialImportState(repositoryId: number): GitHubImportState {
  return {
    phase: "issues",
    repositoryId,
    startedAt: new Date().toISOString(),
    issueCursor: null,
    pullCursor: null,
    moreIssues: true,
    currentIssue: null,
    imported: 0,
    updated: 0,
    skipped: 0,
  };
}

export function importProgress(runId: string, state: GitHubImportState) {
  return {
    runId,
    pending:
      state.phase !== "complete" || Boolean(state.pendingNotifications?.length),
    imported: state.imported,
    updated: state.updated,
    skipped: state.skipped,
  };
}
