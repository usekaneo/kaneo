import { findExternalLinkByTaskAndType } from "../../github/services/link-manager";
import type { PluginContext, TaskCommentCreatedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { parseIssueIid } from "../utils/issue-iid";
import { recordOutboundNoteId } from "../utils/outbound-notes";

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  const existingLink = await findExternalLinkByTaskAndType(
    event.taskId,
    context.integrationId,
    "issue",
  );

  if (!existingLink) {
    return;
  }

  const issueIid = parseIssueIid(existingLink.externalId);
  if (issueIid === null) {
    console.error("Skipping GitLab comment sync for invalid issue number", {
      taskId: event.taskId,
      externalId: existingLink.externalId,
    });
    return;
  }

  try {
    const note = await createGitlabClient(config).createIssueNote(
      issueIid,
      event.comment,
    );

    // GitLab posts this note straight back as a note webhook, authored by the
    // token's own user. Without remembering the id, that echo lands as a
    // second, external copy of the comment on the task.
    //
    // The id can only be known once the POST returns, so a webhook that beats
    // this write still slips through. Closing that window would mean matching
    // on note content, which would also swallow a genuine identical comment, or
    // storing the token's own user id, which would swallow every comment the
    // operator writes in GitLab under that account. Both cost more than the
    // narrow race they close, so the ordering stands.
    await recordOutboundNoteId(existingLink.id, note.id);
  } catch (error) {
    console.error("Failed to create GitLab comment:", error);
  }
}
