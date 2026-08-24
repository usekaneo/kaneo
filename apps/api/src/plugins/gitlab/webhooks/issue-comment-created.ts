import db from "../../../database";
import { activityTable } from "../../../database/schema";
import { findExternalLink } from "../../github/services/link-manager";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type NoteCreatedPayload = {
  object_attributes: {
    id: number;
    note: string;
    noteable_type: string;
    url?: string;
    created_at: string;
  };
  issue?: { iid: number };
  user?: { username?: string; avatar_url?: string } | null;
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabIssueCommentCreated(
  payload: NoteCreatedPayload,
  integrationId?: string,
) {
  const { object_attributes: note, issue, project } = payload;

  if (note.noteable_type !== "Issue" || !issue) {
    return;
  }

  const username = payload.user?.username ?? "";
  if (username.endsWith("-bot") || username.endsWith("[bot]")) {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  const noteUrl =
    note.url ?? `${project.web_url}/-/issues/${issue.iid}#note_${note.id}`;

  for (const integration of integrations) {
    const existingLink = await findExternalLink(
      integration.id,
      "issue",
      issue.iid.toString(),
    );

    if (!existingLink) {
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
        externalUrl: noteUrl,
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
