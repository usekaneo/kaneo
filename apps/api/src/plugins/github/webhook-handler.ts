import { findAllIntegrationsByRepo } from "./services/task-service";
import { getGithubApp } from "./utils/github-app";
import { verifyGithubWebhookSignature } from "./utils/verify-webhook-signature";
import { dispatchGithubEvent } from "./webhook-dispatch";
import { handleIssueClosed } from "./webhooks/issue-closed";
import { handleIssueCommentCreated } from "./webhooks/issue-comment-created";
import { handleIssueEdited } from "./webhooks/issue-edited";
import { handleIssueLabeled } from "./webhooks/issue-labeled";
import { handleIssueOpened } from "./webhooks/issue-opened";
import { handleIssueReopened } from "./webhooks/issue-reopened";
import { handleLabelCreated } from "./webhooks/label-created";
import { handlePullRequestClosed } from "./webhooks/pull-request-closed";
import { handlePullRequestOpened } from "./webhooks/pull-request-opened";
import { handlePush } from "./webhooks/push";

// Deliveries for a PAT-based integration are signed with that project's own
// webhook secret, which the GitHub App SDK cannot verify. Look the repo up, and
// when it belongs to a token integration verify the HMAC ourselves and dispatch
// to the same handlers. Returns { handled: false } so the caller falls back to
// the App path for App-based repos.
async function tryHandleTokenDelivery(
  body: string,
  signature: string,
  eventName: string,
): Promise<{
  handled: boolean;
  result?: { success: boolean; error?: string };
}> {
  let payload: { repository?: { owner?: { login?: string }; name?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return { handled: false };
  }

  const owner = payload.repository?.owner?.login;
  const name = payload.repository?.name;
  if (!owner || !name) {
    return { handled: false };
  }

  const integrations = await findAllIntegrationsByRepo(owner, name);
  const tokenIntegration = integrations.find((integration) => {
    try {
      const config = JSON.parse(integration.config);
      return Boolean(config.accessToken && config.webhookSecret);
    } catch {
      return false;
    }
  });

  if (!tokenIntegration) {
    return { handled: false };
  }

  const config = JSON.parse(tokenIntegration.config) as {
    webhookSecret: string;
  };

  if (!verifyGithubWebhookSignature(config.webhookSecret, signature, body)) {
    console.error("[GitHub Webhook] Invalid signature for token integration");
    return {
      handled: true,
      result: { success: false, error: "Invalid signature" },
    };
  }

  await dispatchGithubEvent(eventName, payload as { action?: string });
  return { handled: true, result: { success: true } };
}

export async function handleGitHubWebhook(
  body: string,
  signature: string,
  eventName: string,
  deliveryId: string,
): Promise<{ success: boolean; error?: string }> {
  console.log(
    `[GitHub Webhook] Received event: ${eventName}, delivery: ${deliveryId}`,
  );

  const tokenDelivery = await tryHandleTokenDelivery(
    body,
    signature,
    eventName,
  );
  if (tokenDelivery.handled) {
    return tokenDelivery.result ?? { success: true };
  }

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

  githubApp.webhooks.on("issues.reopened", async ({ payload }) => {
    console.log("[GitHub Webhook] Handling issues.reopened");
    try {
      await handleIssueReopened(
        payload as Parameters<typeof handleIssueReopened>[0],
      );
      console.log("[GitHub Webhook] issues.reopened handled successfully");
    } catch (error) {
      console.error("[GitHub Webhook] issues.reopened handler error:", error);
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
