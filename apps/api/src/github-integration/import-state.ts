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
    pending: state.phase !== "complete",
    imported: state.imported,
    updated: state.updated,
    skipped: state.skipped,
  };
}
