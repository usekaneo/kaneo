import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { activityTable } from "../../../database/schema";
import { findExternalLink } from "../../github/services/link-manager";
import {
  findAllIntegrationsByGiteaRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

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
      login?: string;
      username?: string;
      avatar_url: string;
    } | null;
    created_at: string;
  };
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

export async function handleGiteaIssueCommentCreated(
  payload: IssueCommentCreatedPayload,
) {
  const { issue, comment, repository } = payload;

  if (payload.action !== "created") {
    return;
  }

  const username = comment.user?.login ?? comment.user?.username ?? "";
  if (username.endsWith("[bot]")) {
    return;
  }

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) return;

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
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

    const existingActivities = await db.query.activityTable.findMany({
      where: and(
        eq(activityTable.taskId, existingLink.taskId),
        eq(activityTable.externalSource, "gitea"),
      ),
    });

    const alreadyExists = existingActivities.some((activity) => {
      const eventData = activity.eventData;
      const externalCommentId =
        typeof eventData === "object" &&
        eventData &&
        "externalCommentId" in eventData
          ? eventData.externalCommentId
          : undefined;

      return (
        externalCommentId === comment.id ||
        activity.externalUrl === comment.html_url
      );
    });

    if (alreadyExists) {
      continue;
    }

    await db.insert(activityTable).values({
      taskId: existingLink.taskId,
      type: "comment",
      content: comment.body,
      externalUserName: username || "Unknown",
      externalUserAvatar: comment.user?.avatar_url ?? null,
      externalSource: "gitea",
      externalUrl: comment.html_url,
      eventData: {
        externalCommentId: comment.id,
      },
    });
  }
}
