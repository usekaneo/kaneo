import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable, taskTable } from "../../../database/schema";
import { updateExternalLink } from "../../github/services/link-manager";
import { updateTaskStatus } from "../../github/services/task-service";
import {
  findAllIntegrationsByGiteaRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

type IssueReopenedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    html_url: string;
    state: string;
  };
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

export async function handleGiteaIssueReopened(payload: IssueReopenedPayload) {
  if (payload.action !== "reopened") {
    return;
  }

  const { issue, repository } = payload;

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) return;

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
    repository.name,
  );

  for (const integration of integrations) {
    try {
      const externalLink = await db.query.externalLinkTable.findFirst({
        where: and(
          eq(externalLinkTable.integrationId, integration.id),
          eq(externalLinkTable.resourceType, "issue"),
          eq(externalLinkTable.externalId, issue.number.toString()),
        ),
      });

      if (!externalLink) {
        continue;
      }

      const task = await db.query.taskTable.findFirst({
        where: eq(taskTable.id, externalLink.taskId),
      });

      if (!task) {
        continue;
      }

      let existingMetadata: Record<string, unknown> = {};
      if (externalLink.metadata) {
        try {
          existingMetadata = JSON.parse(externalLink.metadata) as Record<
            string,
            unknown
          >;
        } catch (error) {
          console.warn("Failed to parse Gitea issue metadata for reopen sync", {
            externalLinkId: externalLink.id,
            metadata: externalLink.metadata,
            error,
          });
        }
      }

      if (existingMetadata.createdFrom === "kaneo") {
        continue;
      }

      const targetStatus = await resolveTargetStatus(
        task.projectId,
        "issue_reopened",
        "to-do",
      );

      await updateTaskStatus(task.id, targetStatus);

      await updateExternalLink(externalLink.id, {
        metadata: {
          ...existingMetadata,
          state: "open",
        },
      });
    } catch (error) {
      console.error("Gitea issue_reopened handler failed for integration", {
        integrationId: integration.id,
        error,
      });
    }
  }
}
