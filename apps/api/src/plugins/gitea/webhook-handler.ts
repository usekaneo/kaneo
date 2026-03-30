import { eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type { GiteaConfig } from "./config";
import { verifyGiteaSignature } from "./utils/verify-signature";
import { handleGiteaIssueClosed } from "./webhooks/issue-closed";
import { handleGiteaIssueCommentCreated } from "./webhooks/issue-comment-created";
import { handleGiteaIssueEdited } from "./webhooks/issue-edited";
import { handleGiteaIssueLabeled } from "./webhooks/issue-labeled";
import { handleGiteaIssueOpened } from "./webhooks/issue-opened";
import { handleGiteaLabelCreated } from "./webhooks/label-created";
import { handleGiteaPullRequestClosed } from "./webhooks/pull-request-closed";
import { handleGiteaPullRequestOpened } from "./webhooks/pull-request-opened";
import { handleGiteaPush } from "./webhooks/push";

export async function handleGiteaWebhookRequest(
  integrationId: string,
  rawBody: string,
  signatureHeader: string | undefined,
  eventHeader: string | undefined,
): Promise<{ success: boolean; error?: string }> {
  const integration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });

  if (!integration || integration.type !== "gitea") {
    return { success: false, error: "Gitea integration not found" };
  }

  let config: GiteaConfig;
  try {
    config = JSON.parse(integration.config) as GiteaConfig;
  } catch {
    return { success: false, error: "Invalid integration config" };
  }

  const secret = config.webhookSecret;
  if (!secret) {
    return { success: false, error: "Webhook secret not configured" };
  }

  if (!verifyGiteaSignature(rawBody, secret, signatureHeader)) {
    return { success: false, error: "Invalid webhook signature" };
  }

  const event = eventHeader || undefined;

  if (!event) {
    return { success: false, error: "Missing event name" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }

  try {
    await dispatchGiteaEvent(event, payload);
    return { success: true };
  } catch (error) {
    console.error("[Gitea Webhook] Handler error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook handler failed",
    };
  }
}

async function dispatchGiteaEvent(
  event: string,
  payload: Record<string, unknown>,
) {
  console.log(`[Gitea Webhook] Event: ${event}`);

  switch (event) {
    case "push":
      await handleGiteaPush(payload as never);
      return;
    case "pull_request": {
      const action = payload.action as string | undefined;
      if (
        action === "opened" ||
        action === "reopened" ||
        action === "ready_for_review"
      ) {
        await handleGiteaPullRequestOpened(payload as never);
      } else if (action === "closed") {
        await handleGiteaPullRequestClosed(payload as never);
      }
      return;
    }
    case "issues": {
      const action = payload.action as string | undefined;
      // Gitea uses "created" for new issues; GitHub-style is "opened"
      if (action === "opened" || action === "created") {
        await handleGiteaIssueOpened(payload as never);
      } else if (action === "closed") {
        await handleGiteaIssueClosed(payload as never);
      } else if (action === "edited") {
        await handleGiteaIssueEdited(payload as never);
      } else if (
        action === "labeled" ||
        action === "unlabeled" ||
        action === "label_updated"
      ) {
        await handleGiteaIssueLabeled({
          ...payload,
          action: action ?? "",
        } as never);
      }
      return;
    }
    case "issue_comment": {
      const action = payload.action as string | undefined;
      if (action === "created") {
        await handleGiteaIssueCommentCreated(payload as never);
      }
      return;
    }
    case "create": {
      await handleGiteaLabelCreated(payload as never);
      return;
    }
    default:
      console.log(`[Gitea Webhook] Ignored event: ${event}`);
  }
}
