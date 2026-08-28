import { eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type { GitlabConfig } from "./config";
import { verifyGitlabWebhookToken } from "./utils/verify-token";
import { handleGitlabIssueOpened } from "./webhooks/issue-opened";
import {
  handleGitlabIssueClosed,
  handleGitlabIssueReopened,
} from "./webhooks/issue-state-changed";
import { handleGitlabIssueUpdated } from "./webhooks/issue-updated";
import { handleGitlabMergeRequestClosed } from "./webhooks/merge-request-closed";
import { handleGitlabMergeRequestOpened } from "./webhooks/merge-request-opened";
import { handleGitlabMergeRequestUpdated } from "./webhooks/merge-request-updated";
import { handleGitlabNoteCreated } from "./webhooks/note-created";
import { handleGitlabPush } from "./webhooks/push";

type IssuePayload = Parameters<typeof handleGitlabIssueOpened>[0];
type IssueUpdatedPayload = Parameters<typeof handleGitlabIssueUpdated>[0];
type MergeRequestPayload = Parameters<typeof handleGitlabMergeRequestOpened>[0];
type NotePayload = Parameters<typeof handleGitlabNoteCreated>[0];
type PushPayload = Parameters<typeof handleGitlabPush>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasProject(payload: Record<string, unknown>) {
  return isRecord(payload.project);
}

function isPushPayload(
  payload: Record<string, unknown>,
): payload is PushPayload {
  return typeof payload.ref === "string" && hasProject(payload);
}

function hasObjectAttributes(payload: Record<string, unknown>) {
  return hasProject(payload) && isRecord(payload.object_attributes);
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

  if (!verifyGitlabWebhookToken(secret, tokenHeader)) {
    return { success: false, error: "Invalid webhook token" };
  }

  if (!eventHeader) {
    return { success: false, error: "Missing event name" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }

  try {
    await dispatchGitlabEvent(payload, integration.id);
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
  payload: Record<string, unknown>,
  integrationId: string,
) {
  // `object_kind` is carried in the body itself, so it is the reliable
  // discriminator; X-Gitlab-Event only supplies a display name ("Push Hook").
  const kind = payload.object_kind;

  switch (kind) {
    case "push":
      if (isPushPayload(payload)) {
        await handleGitlabPush(payload, integrationId);
      }
      return;
    case "merge_request": {
      if (!hasObjectAttributes(payload)) return;
      const mr = payload as unknown as MergeRequestPayload;
      const action = mr.object_attributes.action;
      if (action === "open" || action === "reopen") {
        await handleGitlabMergeRequestOpened(mr, integrationId);
      } else if (action === "close" || action === "merge") {
        await handleGitlabMergeRequestClosed(mr, integrationId);
      } else if (action === "update") {
        await handleGitlabMergeRequestUpdated(mr, integrationId);
      }
      return;
    }
    case "issue": {
      if (!hasObjectAttributes(payload)) return;
      const issue = payload as unknown as IssuePayload;
      const action = issue.object_attributes.action;
      if (action === "open") {
        await handleGitlabIssueOpened(issue, integrationId);
      } else if (action === "close") {
        await handleGitlabIssueClosed(issue, integrationId);
      } else if (action === "reopen") {
        await handleGitlabIssueReopened(issue, integrationId);
      } else if (action === "update") {
        await handleGitlabIssueUpdated(
          payload as unknown as IssueUpdatedPayload,
          integrationId,
        );
      }
      return;
    }
    case "note": {
      if (!hasObjectAttributes(payload)) return;
      await handleGitlabNoteCreated(
        payload as unknown as NotePayload,
        integrationId,
      );
      return;
    }
    default:
      console.log(`[GitLab Webhook] Ignored event: ${String(kind)}`);
  }
}
