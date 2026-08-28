import db from "../../../database";
import { activityTable } from "../../../database/schema";
import { findExternalLink } from "../../github/services/link-manager";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { isOutboundNoteId } from "../utils/outbound-notes";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";
import type { GitlabWebhookProject, GitlabWebhookUser } from "./types";

export type NotePayload = {
  object_attributes: {
    id: number;
    note: string;
    noteable_type?: string;
    url: string;
    system?: boolean;
  };
  issue?: { iid?: number };
  user?: GitlabWebhookUser | null;
  project: GitlabWebhookProject;
};

export async function handleGitlabNoteCreated(
  payload: NotePayload,
  integrationId?: string,
) {
  const note = payload.object_attributes;
  const { project } = payload;

  // Only issue comments map to task activity, and GitLab's own bookkeeping
  // notes ("changed the description") are not user comments.
  if (note.noteable_type !== "Issue" || note.system) {
    return;
  }

  const issueIid = payload.issue?.iid;
  if (typeof issueIid !== "number") {
    return;
  }

  const username = payload.user?.username ?? payload.user?.name ?? "";
  if (username.endsWith("[bot]")) {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(project);
  if (!baseUrl || !project.path_with_namespace) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  for (const integration of integrations) {
    const existingLink = await findExternalLink(
      integration.id,
      "issue",
      issueIid.toString(),
    );

    if (!existingLink) {
      continue;
    }

    // A note Kaneo posted itself comes back through this webhook authored by
    // the token's own user, which the [bot] check cannot catch.
    if (isOutboundNoteId(existingLink.metadata, note.id)) {
      continue;
    }

    await db
      .insert(activityTable)
      .values({
        taskId: existingLink.taskId,
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
