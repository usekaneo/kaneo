import { getGithubApp } from "./utils/github-app";
import { handleIssueClosed } from "./webhooks/issue-closed";
import { handleIssueOpened } from "./webhooks/issue-opened";
import { handlePullRequestClosed } from "./webhooks/pull-request-closed";
import { handlePullRequestOpened } from "./webhooks/pull-request-opened";
import { handlePush } from "./webhooks/push";

export async function handleGitHubWebhook(
  body: string,
  signature: string,
  eventName: string,
  deliveryId: string,
): Promise<{ success: boolean; error?: string }> {
  const githubApp = getGithubApp();

  if (!githubApp) {
    return { success: false, error: "GitHub integration not configured" };
  }

  try {
    await githubApp.webhooks.verifyAndReceive({
      id: deliveryId,
      name: eventName as "issues" | "pull_request" | "push",
      signature,
      payload: body,
    });

    return { success: true };
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Webhook verification failed",
    };
  }
}

export function setupWebhookHandlers() {
  const githubApp = getGithubApp();

  if (!githubApp) {
    console.log("GitHub App not configured, skipping webhook handlers");
    return;
  }

  githubApp.webhooks.on("issues.opened", async ({ payload }) => {
    await handleIssueOpened(payload as Parameters<typeof handleIssueOpened>[0]);
  });

  githubApp.webhooks.on("issues.closed", async ({ payload }) => {
    await handleIssueClosed(payload as Parameters<typeof handleIssueClosed>[0]);
  });

  githubApp.webhooks.on("push", async ({ payload }) => {
    await handlePush(payload as Parameters<typeof handlePush>[0]);
  });

  githubApp.webhooks.on("pull_request.opened", async ({ payload }) => {
    await handlePullRequestOpened(
      payload as Parameters<typeof handlePullRequestOpened>[0],
    );
  });

  githubApp.webhooks.on("pull_request.closed", async ({ payload }) => {
    await handlePullRequestClosed(
      payload as Parameters<typeof handlePullRequestClosed>[0],
    );
  });

  githubApp.webhooks.on("pull_request.reopened", async ({ payload }) => {
    await handlePullRequestOpened(
      payload as Parameters<typeof handlePullRequestOpened>[0],
    );
  });

  console.log("✓ GitHub webhook handlers registered");
}
