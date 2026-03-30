import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { updateExternalLink } from "../../github/services/link-manager";
import {
  findTaskById,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GiteaConfig } from "../config";
import {
  findAllIntegrationsByGiteaRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

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
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

export async function handleGiteaPullRequestClosed(payload: PRClosedPayload) {
  const { pull_request, repository } = payload;

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) return;

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
    repository.name,
  );

  for (const integration of integrations) {
    const config = JSON.parse(integration.config) as GiteaConfig;

    const externalLink = await db.query.externalLinkTable.findFirst({
      where: and(
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "pull_request"),
        eq(externalLinkTable.externalId, pull_request.number.toString()),
      ),
    });

    if (!externalLink) {
      continue;
    }

    const task = await findTaskById(externalLink.taskId);

    if (!task) {
      continue;
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
      const allTaskPRs = await db.query.externalLinkTable.findMany({
        where: and(
          eq(externalLinkTable.taskId, task.id),
          eq(externalLinkTable.resourceType, "pull_request"),
        ),
      });

      const hasOpenPRs = allTaskPRs.some((pr) => {
        if (pr.id === externalLink.id) return false;
        const metadata = pr.metadata ? JSON.parse(pr.metadata) : {};
        return metadata.state === "open";
      });

      if (!hasOpenPRs) {
        const targetStatus = await resolveTargetStatus(
          integration.projectId,
          "pr_merged",
          config.statusTransitions?.onPRMerge || "done",
        );
        await updateTaskStatus(task.id, targetStatus);
      }
    }

    return;
  }
}
