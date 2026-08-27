import { handleIssueClosed } from "./webhooks/issue-closed";
import { handleIssueCommentCreated } from "./webhooks/issue-comment-created";
import { handleIssueEdited } from "./webhooks/issue-edited";
import { handleIssueLabeled } from "./webhooks/issue-labeled";
import { handleIssueOpened } from "./webhooks/issue-opened";
import { handleIssueReopened } from "./webhooks/issue-reopened";
import { handlePullRequestClosed } from "./webhooks/pull-request-closed";
import { handlePullRequestOpened } from "./webhooks/pull-request-opened";
import { handlePush } from "./webhooks/push";

type WebhookPayload = { action?: string } & Record<string, unknown>;

// Dispatch a verified webhook delivery to the matching handler. This mirrors the
// event routing the GitHub App registers via `webhooks.on(...)`, but is driven
// by the already-parsed payload so PAT-based integrations (whose deliveries the
// App SDK cannot verify) reach the same handlers. Unhandled events are ignored.
export async function dispatchGithubEvent(
  eventName: string,
  payload: WebhookPayload,
): Promise<void> {
  const action = payload.action;

  switch (eventName) {
    case "push":
      await handlePush(payload as Parameters<typeof handlePush>[0]);
      return;

    case "pull_request":
      if (action === "opened" || action === "reopened") {
        await handlePullRequestOpened(
          payload as Parameters<typeof handlePullRequestOpened>[0],
        );
      } else if (action === "closed") {
        await handlePullRequestClosed(
          payload as Parameters<typeof handlePullRequestClosed>[0],
        );
      }
      return;

    case "issues":
      switch (action) {
        case "opened":
          await handleIssueOpened(
            payload as Parameters<typeof handleIssueOpened>[0],
          );
          return;
        case "closed":
          await handleIssueClosed(
            payload as Parameters<typeof handleIssueClosed>[0],
          );
          return;
        case "reopened":
          await handleIssueReopened(
            payload as Parameters<typeof handleIssueReopened>[0],
          );
          return;
        case "edited":
          await handleIssueEdited(
            payload as Parameters<typeof handleIssueEdited>[0],
          );
          return;
        case "labeled":
        case "unlabeled":
          await handleIssueLabeled(
            payload as Parameters<typeof handleIssueLabeled>[0],
          );
          return;
        default:
          return;
      }

    case "issue_comment":
      if (action === "created") {
        await handleIssueCommentCreated(
          payload as Parameters<typeof handleIssueCommentCreated>[0],
        );
      }
      return;

    default:
      return;
  }
}
