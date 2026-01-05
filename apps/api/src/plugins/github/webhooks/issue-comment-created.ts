import db from "../../../database";
import { activityTable } from "../../../database/schema";
import { findExternalLink } from "../services/link-manager";
import { findAllIntegrationsByRepo } from "../services/task-service";

type IssueCommentCreatedPayload = {
  action: string;
  issue: {
    number: number;
  };
  comment: {
    id: number;
    body: string;
    html_url: string;
    user: {
      login: string;
      avatar_url: string;
    } | null;
    created_at: string;
  };
  repository: {
    owner: { login: string };
    name: string;
  };
};

export async function handleIssueCommentCreated(
  payload: IssueCommentCreatedPayload,
) {
  const { issue, comment, repository } = payload;

  if (payload.action !== "created") {
    return;
  }

  const username = comment.user?.login ?? "";
  if (username.endsWith("[bot]")) {
    return;
  }

  const integrations = await findAllIntegrationsByRepo(
    repository.owner.login,
    repository.name,
  );

  for (const integration of integrations) {
    const existingLink = await findExternalLink(
      integration.id,
      "issue",
      issue.number.toString(),
    );

    if (!existingLink) {
      continue;
    }

    await db.insert(activityTable).values({
      taskId: existingLink.taskId,
      type: "comment",
      content: comment.body,
      externalUserName: comment.user?.login ?? "Unknown",
      externalUserAvatar: comment.user?.avatar_url ?? null,
      externalSource: "github",
      externalUrl: comment.html_url,
    });

    return;
  }
}
