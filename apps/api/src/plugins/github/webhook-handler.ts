import { getGithubApp } from "./utils/github-app";
import { handleIssueClosed } from "./webhooks/issue-closed";
import { handleIssueCommentCreated } from "./webhooks/issue-comment-created";
import { handleIssueEdited } from "./webhooks/issue-edited";
import { handleIssueLabeled } from "./webhooks/issue-labeled";
import { handleIssueOpened } from "./webhooks/issue-opened";
import { handleLabelCreated } from "./webhooks/label-created";
import { handlePullRequestClosed } from "./webhooks/pull-request-closed";
import { handlePullRequestOpened } from "./webhooks/pull-request-opened";
import { handlePush } from "./webhooks/push";

export async function handleGitHubWebhook(
  body: string,
  signature: string,
  eventName: string,
  deliveryId: string,
): Promise<{ success: boolean; error?: string }> {
  console.log(
    `[GitHub Webhook] Received event: ${eventName}, delivery: ${deliveryId}`,
  );

  const githubApp = getGithubApp();

  if (!githubApp) {
    console.error("[GitHub Webhook] GitHub App not configured");
    return { success: false, error: "GitHub integration not configured" };
  }

  try {
    console.log(`[GitHub Webhook] Verifying and processing ${eventName}...`);
    await githubApp.webhooks.verifyAndReceive({
      id: deliveryId,
      name: eventName as
        | "issues"
        | "pull_request"
        | "push"
        | "label"
        | "issue_comment",
      signature,
      payload: body,
    });

    console.log(`[GitHub Webhook] Successfully processed ${eventName}`);
    return { success: true };
  } catch (error) {
    console.error("[GitHub Webhook] Verification/processing failed:", error);
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
    console.log("[GitHub Webhook] Handling issues.opened");
    try {
      await handleIssueOpened(
        payload as Parameters<typeof handleIssueOpened>[0],
      );
      console.log("[GitHub Webhook] issues.opened handled successfully");
    } catch (error) {
      console.error("[GitHub Webhook] issues.opened handler error:", error);
      throw error;
    }
  });

  githubApp.webhooks.on("issues.closed", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling issues.closed");
    try {
      await handleIssueClosed(
        payload as Parameters<typeof handleIssueClosed>[0],
      );
      console.log("[GitHub Webhook] issues.closed handled successfully");
    } catch (error) {
      console.error("[GitHub Webhook] issues.closed handler error:", error);
      throw error;
    }
  });

  githubApp.webhooks.on("issues.labeled", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling issues.labeled");
    try {
      await handleIssueLabeled(
        payload as Parameters<typeof handleIssueLabeled>[0],
      );
      console.log("[GitHub Webhook] issues.labeled handled successfully");
    } catch (error) {
      console.error("[GitHub Webhook] issues.labeled handler error:", error);
      throw error;
    }
  });

  githubApp.webhooks.on("issues.unlabeled", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling issues.unlabeled");
    try {
      await handleIssueLabeled(
        payload as Parameters<typeof handleIssueLabeled>[0],
      );
      console.log("[GitHub Webhook] issues.unlabeled handled successfully");
    } catch (error) {
      console.error("[GitHub Webhook] issues.unlabeled handler error:", error);
      throw error;
    }
  });

  githubApp.webhooks.on("issues.edited", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling issues.edited");
    try {
      await handleIssueEdited(
        payload as Parameters<typeof handleIssueEdited>[0],
      );
      console.log("[GitHub Webhook] issues.edited handled successfully");
    } catch (error) {
      console.error("[GitHub Webhook] issues.edited handler error:", error);
      throw error;
    }
  });

  githubApp.webhooks.on("push", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling push");
    try {
      await handlePush(payload as Parameters<typeof handlePush>[0]);
      console.log("[GitHub Webhook] push handled successfully");
    } catch (error) {
      console.error("[GitHub Webhook] push handler error:", error);
      throw error;
    }
  });

  githubApp.webhooks.on("pull_request.opened", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling pull_request.opened");
    try {
      await handlePullRequestOpened(
        payload as Parameters<typeof handlePullRequestOpened>[0],
      );
      console.log("[GitHub Webhook] pull_request.opened handled successfully");
    } catch (error) {
      console.error(
        "[GitHub Webhook] pull_request.opened handler error:",
        error,
      );
      throw error;
    }
  });

  githubApp.webhooks.on("pull_request.closed", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling pull_request.closed");
    try {
      await handlePullRequestClosed(
        payload as Parameters<typeof handlePullRequestClosed>[0],
      );
      console.log("[GitHub Webhook] pull_request.closed handled successfully");
    } catch (error) {
      console.error(
        "[GitHub Webhook] pull_request.closed handler error:",
        error,
      );
      throw error;
    }
  });

  githubApp.webhooks.on("pull_request.reopened", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling pull_request.reopened");
    try {
      await handlePullRequestOpened(
        payload as Parameters<typeof handlePullRequestOpened>[0],
      );
      console.log(
        "[GitHub Webhook] pull_request.reopened handled successfully",
      );
    } catch (error) {
      console.error(
        "[GitHub Webhook] pull_request.reopened handler error:",
        error,
      );
      throw error;
    }
  });

  githubApp.webhooks.on("label.created", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling label.created");
    try {
      await handleLabelCreated(
        payload as Parameters<typeof handleLabelCreated>[0],
      );
      console.log("[GitHub Webhook] label.created handled successfully");
    } catch (error) {
      console.error("[GitHub Webhook] label.created handler error:", error);
      throw error;
    }
  });

  githubApp.webhooks.on("issue_comment.created", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling issue_comment.created");
    try {
      await handleIssueCommentCreated(
        payload as Parameters<typeof handleIssueCommentCreated>[0],
      );
      console.log(
        "[GitHub Webhook] issue_comment.created handled successfully",
      );
    } catch (error) {
      console.error(
        "[GitHub Webhook] issue_comment.created handler error:",
        error,
      );
      throw error;
    }
  });

  githubApp.webhooks.onError((error) => {
    console.error("[GitHub Webhook] Error in webhook handler:", error);
  });

  console.log("✓ GitHub webhook handlers registered");
}
