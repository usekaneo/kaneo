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
import { handleGiteaIssueReopened } from "./webhooks/issue-reopened";
import { handleGiteaLabelCreated } from "./webhooks/label-created";
import { handleGiteaPullRequestClosed } from "./webhooks/pull-request-closed";
import { handleGiteaPullRequestOpened } from "./webhooks/pull-request-opened";
import { handleGiteaPush } from "./webhooks/push";

type GiteaPushPayload = Parameters<typeof handleGiteaPush>[0];
type GiteaPullRequestPayload = Parameters<
  typeof handleGiteaPullRequestOpened
>[0];
type GiteaPullRequestClosedPayload = Parameters<
  typeof handleGiteaPullRequestClosed
>[0];
type GiteaIssuePayload = Parameters<typeof handleGiteaIssueOpened>[0];
type GiteaIssueClosedPayload = Parameters<typeof handleGiteaIssueClosed>[0];
type GiteaIssueReopenedPayload = Parameters<typeof handleGiteaIssueReopened>[0];
type GiteaIssueCommentPayload = Parameters<
  typeof handleGiteaIssueCommentCreated
>[0];
type GiteaLabelPayload = Parameters<typeof handleGiteaLabelCreated>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasRepository(value: Record<string, unknown>) {
  return isRecord(value.repository);
}

function isPushPayload(
  payload: Record<string, unknown>,
): payload is GiteaPushPayload {
  return typeof payload.ref === "string" && hasRepository(payload);
}

function isPullRequestPayload(
  payload: Record<string, unknown>,
): payload is GiteaPullRequestPayload {
  return hasRepository(payload) && isRecord(payload.pull_request);
}

function isIssuePayload(
  payload: Record<string, unknown>,
): payload is GiteaIssuePayload {
  return hasRepository(payload) && isRecord(payload.issue);
}

function isIssueCommentPayload(
  payload: Record<string, unknown>,
): payload is GiteaIssueCommentPayload {
  return (
    hasRepository(payload) &&
    isRecord(payload.issue) &&
    isRecord(payload.comment)
  );
}

function isLabelPayload(
  payload: Record<string, unknown>,
): payload is GiteaLabelPayload {
  return hasRepository(payload);
}

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
      if (isPushPayload(payload)) {
        await handleGiteaPush(payload);
      }
      return;
    case "pull_request": {
      const action = payload.action as string | undefined;
      if (
        action === "opened" ||
        action === "reopened" ||
        action === "ready_for_review"
      ) {
        if (isPullRequestPayload(payload)) {
          await handleGiteaPullRequestOpened(payload);
        }
      } else if (action === "closed" && isPullRequestPayload(payload)) {
        await handleGiteaPullRequestClosed(
          payload as unknown as GiteaPullRequestClosedPayload,
        );
      }
      return;
    }
    case "issues": {
      const action = payload.action as string | undefined;
      // Gitea uses "created" for new issues; GitHub-style is "opened"
      if (
        (action === "opened" || action === "created") &&
        isIssuePayload(payload)
      ) {
        await handleGiteaIssueOpened(payload);
      } else if (action === "reopened" && isIssuePayload(payload)) {
        await handleGiteaIssueReopened(
          payload as unknown as GiteaIssueReopenedPayload,
        );
      } else if (action === "closed" && isIssuePayload(payload)) {
        await handleGiteaIssueClosed(
          payload as unknown as GiteaIssueClosedPayload,
        );
      } else if (action === "edited" && isIssuePayload(payload)) {
        await handleGiteaIssueEdited(payload);
      } else if (
        isIssuePayload(payload) &&
        (action === "labeled" ||
          action === "unlabeled" ||
          action === "label_updated")
      ) {
        await handleGiteaIssueLabeled({
          ...payload,
          action: action ?? "",
        });
      }
      return;
    }
    case "issue_comment": {
      const action = payload.action as string | undefined;
      if (action === "created" && isIssueCommentPayload(payload)) {
        await handleGiteaIssueCommentCreated(payload);
      }
      return;
    }
    case "issue_label": {
      if (isLabelPayload(payload)) {
        await handleGiteaLabelCreated(payload);
      }
      return;
    }
    default:
      console.log(`[Gitea Webhook] Ignored event: ${event}`);
  }
}
