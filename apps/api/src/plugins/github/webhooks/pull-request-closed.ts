import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import type { GitHubConfig } from "../config";
import { updateExternalLink } from "../services/link-manager";
import {
  findIntegrationByRepo,
  findTaskById,
  updateTaskStatus,
} from "../services/task-service";

type PRClosedPayload = {
  action: string;
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    state: string;
    merged: boolean;
    merged_at: string | null;
    head: {
      ref: string;
    };
  };
  repository: {
    owner: { login: string };
    name: string;
  };
};

export async function handlePullRequestClosed(payload: PRClosedPayload) {
  const { pull_request, repository } = payload;

  const integration = await findIntegrationByRepo(
    repository.owner.login,
    repository.name,
  );

  if (!integration) {
    return;
  }

  const config = JSON.parse(integration.config) as GitHubConfig;

  const externalLink = await db.query.externalLinkTable.findFirst({
    where: and(
      eq(externalLinkTable.integrationId, integration.id),
      eq(externalLinkTable.resourceType, "pull_request"),
      eq(externalLinkTable.externalId, pull_request.number.toString()),
    ),
  });

  if (!externalLink) {
    return;
  }

  const task = await findTaskById(externalLink.taskId);

  if (!task) {
    return;
  }

  const existingMetadata = externalLink.metadata
    ? JSON.parse(externalLink.metadata)
    : {};

  await updateExternalLink(externalLink.id, {
    metadata: {
      ...existingMetadata,
      state: "closed",
      merged: pull_request.merged,
      mergedAt: pull_request.merged_at,
    },
  });

  if (pull_request.merged) {
    const targetStatus = config.statusTransitions?.onPRMerge || "done";
    await updateTaskStatus(task.id, targetStatus);
  }
}
