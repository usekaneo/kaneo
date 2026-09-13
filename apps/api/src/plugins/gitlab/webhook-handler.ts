import { eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type { GitlabConfig } from "./config";
import { verifyWebhookToken } from "./utils/verify-token";
import { handleGitlabIssueClosed } from "./webhooks/issue-closed";
import { handleGitlabIssueOpened } from "./webhooks/issue-opened";
import { handleGitlabIssueReopened } from "./webhooks/issue-reopened";
import { handleGitlabIssueUpdated } from "./webhooks/issue-updated";
import { handleGitlabMergeRequestClosed } from "./webhooks/merge-request-closed";
import { handleGitlabMergeRequestOpened } from "./webhooks/merge-request-opened";
import { handleGitlabNoteCreated } from "./webhooks/note-created";
import { handleGitlabPush } from "./webhooks/push";

type GitlabPushPayload = Parameters<typeof handleGitlabPush>[0];
type GitlabIssuePayload = Parameters<typeof handleGitlabIssueOpened>[0];
type GitlabIssueClosedPayload = Parameters<typeof handleGitlabIssueClosed>[0];
type GitlabIssueReopenedPayload = Parameters<
  typeof handleGitlabIssueReopened
>[0];
type GitlabIssueUpdatedPayload = Parameters<typeof handleGitlabIssueUpdated>[0];
type GitlabMergeRequestPayload = Parameters<
  typeof handleGitlabMergeRequestOpened
>[0];
type GitlabMergeRequestClosedPayload = Parameters<
  typeof handleGitlabMergeRequestClosed
>[0];
type GitlabNotePayload = Parameters<typeof handleGitlabNoteCreated>[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasProject(value: Record<string, unknown>) {
  return isRecord(value.project);
}

function hasObjectAttributes(value: Record<string, unknown>) {
  return isRecord(value.object_attributes);
}

function isPushPayload(
  payload: Record<string, unknown>,
): payload is GitlabPushPayload {
  return typeof payload.ref === "string" && hasProject(payload);
}

function isIssuePayload(
  payload: Record<string, unknown>,
): payload is GitlabIssuePayload {
  return hasProject(payload) && hasObjectAttributes(payload);
}

function isMergeRequestPayload(
  payload: Record<string, unknown>,
): payload is GitlabMergeRequestPayload {
  return hasProject(payload) && hasObjectAttributes(payload);
}

function isNotePayload(
  payload: Record<string, unknown>,
): payload is GitlabNotePayload {
  return hasProject(payload) && hasObjectAttributes(payload);
}

function isConfidentialIssue(payload: Record<string, unknown>): boolean {
  const attributes = payload.object_attributes;
  return (
    payload.event_type === "confidential_issue" ||
    (isRecord(attributes) && attributes.confidential === true)
  );
}

function objectAction(payload: Record<string, unknown>): string | undefined {
  const attributes = payload.object_attributes;
  if (!isRecord(attributes)) return undefined;
  return typeof attributes.action === "string" ? attributes.action : undefined;
}

/** Which way an "update" moved the draft flag, or null when it did not. */
function draftChange(
  payload: Record<string, unknown>,
): "entered" | "left" | null {
  const changes = payload.changes;
  if (!isRecord(changes)) return null;
  const draft = changes.draft;
  if (!isRecord(draft) || draft.previous === draft.current) return null;
  return draft.current === true ? "entered" : "left";
}

export async function handleGitlabWebhookRequest(
  integrationId: string,
  rawBody: string,
  tokenHeader: string | undefined,
): Promise<{ success: boolean; error?: string; status?: 400 | 500 }> {
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

  if (!verifyWebhookToken(secret, tokenHeader)) {
    return { success: false, error: "Invalid webhook token" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }

  const objectKind =
    typeof payload.object_kind === "string" ? payload.object_kind : undefined;

  if (!objectKind) {
    return { success: false, error: "Missing object_kind" };
  }

  try {
    await dispatchGitlabEvent(objectKind, payload, integration.id);
    return { success: true };
  } catch (error) {
    console.error("[GitLab Webhook] Handler error:", error);
    // The request itself was valid; the details stay in the server log.
    return { success: false, error: "Webhook handler failed", status: 500 };
  }
}

async function dispatchGitlabEvent(
  objectKind: string,
  payload: Record<string, unknown>,
  integrationId: string,
) {
  console.log(`[GitLab Webhook] Event: ${objectKind}`);

  switch (objectKind) {
    case "push":
      if (isPushPayload(payload)) {
        await handleGitlabPush(payload, integrationId);
      }
      return;
    case "issue": {
      if (!isIssuePayload(payload) || isConfidentialIssue(payload)) {
        return;
      }
      switch (objectAction(payload)) {
        case "open":
          await handleGitlabIssueOpened(payload, integrationId);
          return;
        case "close":
          await handleGitlabIssueClosed(
            payload as unknown as GitlabIssueClosedPayload,
            integrationId,
          );
          return;
        case "reopen":
          await handleGitlabIssueReopened(
            payload as unknown as GitlabIssueReopenedPayload,
            integrationId,
          );
          return;
        case "update":
          await handleGitlabIssueUpdated(
            payload as unknown as GitlabIssueUpdatedPayload,
            integrationId,
          );
          return;
        default:
          return;
      }
    }
    case "merge_request": {
      if (!isMergeRequestPayload(payload)) {
        return;
      }
      const action = objectAction(payload);
      if (action === "open" || action === "reopen") {
        await handleGitlabMergeRequestOpened(payload, integrationId, {
          moveTask: payload.object_attributes.draft !== true,
        });
        return;
      }
      if (action === "update") {
        const change = draftChange(payload);
        if (change) {
          await handleGitlabMergeRequestOpened(payload, integrationId, {
            moveTask: change === "left",
          });
        }
        return;
      }
      if (action === "merge" || action === "close") {
        await handleGitlabMergeRequestClosed(
          payload as unknown as GitlabMergeRequestClosedPayload,
          integrationId,
        );
      }
      return;
    }
    case "note": {
      if (isNotePayload(payload)) {
        await handleGitlabNoteCreated(payload, integrationId);
      }
      return;
    }
    default:
      console.log(`[GitLab Webhook] Ignored event: ${objectKind}`);
  }
}
