import db from "../../../database";
import { activityTable } from "../../../database/schema";
import { findExternalLink } from "../../github/services/link-manager";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import type { GitlabWebhookProject, GitlabWebhookUser } from "../utils/payload";
import { syncedNoteIds } from "../utils/synced-notes";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";

type NoteCreatedPayload = {
  event_type?: string;
  user?: GitlabWebhookUser | null;
  object_attributes: {
    id: number;
    note: string;
    noteable_type: string;
    url: string;
    system?: boolean;
    internal?: boolean;
  };
  issue?: { iid: number };
  project: GitlabWebhookProject;
};

export async function handleGitlabNoteCreated(
  payload: NoteCreatedPayload,
  integrationId?: string,
) {
  const note = payload.object_attributes;

  if (note.noteable_type !== "Issue" || !payload.issue) {
    return;
  }

  // System notes are label/state changes, not comments.
  if (note.system) {
    return;
  }

  // Internal and confidential notes are for project members only.
  if (note.internal || payload.event_type === "confidential_note") {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    payload.project.web_url,
    payload.project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    payload.project.path_with_namespace,
    integrationId,
  );

  const username = payload.user?.username ?? payload.user?.name ?? "";
  const issueIid = payload.issue.iid;

  for (const integration of integrations) {
    const externalLink = await findExternalLink(
      integration.id,
      "issue",
      issueIid.toString(),
    );

    if (!externalLink) {
      continue;
    }

    if (syncedNoteIds(externalLink.metadata).includes(note.id)) {
      continue;
    }

    await db
      .insert(activityTable)
      .values({
        taskId: externalLink.taskId,
        type: "comment",
        content: note.note,
        externalUserName: username || "Unknown",
        externalUserAvatar: payload.user?.avatar_url ?? null,
        externalSource: "gitlab",
        externalUrl: note.url,
        eventData: {
          externalCommentId: note.id,
        },
      })
      .onConflictDoNothing({
        target: [
          activityTable.taskId,
          activityTable.externalSource,
          activityTable.externalUrl,
        ],
      });
  }
}
