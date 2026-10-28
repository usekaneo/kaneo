import { SourceHttpError } from "../http.js";
import type { JiraComment, JiraIssue } from "./api-types.js";
import { COMMENTS_PAGE_SIZE, type JiraClient } from "./client.js";

export const COMMENT_PROGRESS_STEP = 10;

export async function readComments(
  client: JiraClient,
  issues: JiraIssue[],
  onProgress?: (message: string) => void,
): Promise<Map<string, JiraComment[]>> {
  const commented = issues.filter(hasComments);
  const byIssue = new Map<string, JiraComment[]>();

  for (const [index, issue] of commented.entries()) {
    byIssue.set(issue.id, await readIssueComments(client, issue.id));
    const done = index + 1;
    if (done % COMMENT_PROGRESS_STEP === 0 || done === commented.length) {
      onProgress?.(`Reading comments (${done} of ${commented.length})`);
    }
  }

  return byIssue;
}

export function hasComments(issue: JiraIssue): boolean {
  const total = issue.fields?.comment?.total;
  return typeof total !== "number" || total > 0;
}

async function readIssueComments(
  client: JiraClient,
  issueId: string,
): Promise<JiraComment[]> {
  const comments: JiraComment[] = [];
  try {
    for (;;) {
      const page = await client.comments(issueId, comments.length);
      const batch = page?.comments ?? [];
      comments.push(...batch);
      if (isLastPage(batch.length, comments.length, page?.total)) {
        return comments;
      }
    }
  } catch (error) {
    if (!(error instanceof SourceHttpError) || error.status !== 404) {
      throw error;
    }
    return comments;
  }
}

function isLastPage(
  received: number,
  loaded: number,
  total: number | null | undefined,
): boolean {
  if (received === 0) return true;
  return typeof total === "number"
    ? loaded >= total
    : received < COMMENTS_PAGE_SIZE;
}
