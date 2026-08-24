import { eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type { GitlabConfig } from "./config";
import { verifyGitlabWebhookSecret } from "./utils/verify-token";
import { handleGitlabIssueClosed } from "./webhooks/issue-closed";
import { handleGitlabIssueCommentCreated } from "./webhooks/issue-comment-created";
import { handleGitlabIssueEdited } from "./webhooks/issue-edited";
import { handleGitlabIssueLabeled } from "./webhooks/issue-labeled";
import { handleGitlabIssueOpened } from "./webhooks/issue-opened";
import { handleGitlabIssueReopened } from "./webhooks/issue-reopened";
import { handleGitlabMergeRequestClosed } from "./webhooks/merge-request-closed";
import { handleGitlabMergeRequestOpened } from "./webhooks/merge-request-opened";
import { handleGitlabPush } from "./webhooks/push";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasProject(value: Record<string, unknown>) {
  return isRecord(value.project);
}

export async function handleGitlabWebhookRequest(
  integrationId: string,
  rawBody: string,
  tokenHeader: string | undefined,
  eventHeader: string | undefined,
): Promise<{ success: boolean; error?: string }> {
  const integration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });

  if (integration?.type !== "gitlab") {
    return { success: false, error: "GitLab integration not found" };
  }

  let config: GitlabConfig;
  try {
    config = JSON.parse(integration.config) as GitlabConfig;
  } catch {
    return { success: false, error: "Invalid integration config" };
  }

  const secret = config.webhookSecret;
  if (!secret) {
    return { success: false, error: "Webhook secret not configured" };
  }

  if (!verifyGitlabWebhookSecret(secret, tokenHeader)) {
    return { success: false, error: "Invalid webhook token" };
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

  if (!hasProject(payload)) {
    return { success: false, error: "Missing project in payload" };
  }

  try {
    await dispatchGitlabEvent(event, payload, integration.id);
    return { success: true };
  } catch (error) {
    console.error("[GitLab Webhook] Handler error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Webhook handler failed",
    };
  }
}

async function dispatchGitlabEvent(
  event: string,
  // biome-ignore lint/suspicious/noExplicitAny: each handler validates its own payload shape at runtime
  payload: any,
  integrationId: string,
) {
  console.log(`[GitLab Webhook] Event: ${event}`);

  switch (event) {
    case "Push Hook":
      await handleGitlabPush(payload, integrationId);
      return;

    case "Merge Request Hook": {
      const action = payload.object_attributes?.action as string | undefined;
      if (action === "open" || action === "reopen") {
        await handleGitlabMergeRequestOpened(payload, integrationId);
      } else if (action === "close" || action === "merge") {
        await handleGitlabMergeRequestClosed(payload, integrationId);
      }
      return;
    }

    case "Issue Hook": {
      const action = payload.object_attributes?.action as string | undefined;
      if (action === "open") {
        await handleGitlabIssueOpened(payload, integrationId);
      } else if (action === "reopen") {
        await handleGitlabIssueReopened(payload, integrationId);
      } else if (action === "close") {
        await handleGitlabIssueClosed(payload, integrationId);
      } else if (action === "update") {
        // Each handler no-ops on its own when its relevant `changes` field
        // is absent, so both are safe to call unconditionally here.
        await handleGitlabIssueEdited(payload, integrationId);
        await handleGitlabIssueLabeled(payload, integrationId);
      }
      return;
    }

    case "Note Hook": {
      const noteableType = payload.object_attributes?.noteable_type as
        | string
        | undefined;
      if (noteableType === "Issue") {
        await handleGitlabIssueCommentCreated(payload, integrationId);
      }
      return;
    }

    default:
      console.log(`[GitLab Webhook] Ignored event: ${event}`);
  }
}
