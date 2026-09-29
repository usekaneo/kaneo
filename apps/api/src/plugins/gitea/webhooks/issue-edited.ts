import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";
import { confirmedOutboundEcho } from "../../github/utils/sync-echo";
import {
  linkedTaskScope,
  withIntegrationTask,
} from "../../github/services/integration-task-scope";
import { taskTable } from "../../../database/schema";
import {
  findExternalLink,
  lockExternalLink,
  updateExternalLink,
} from "../../github/services/link-manager";
import { formatTaskDescriptionFromIssue } from "../../github/utils/format";
import {
  findAllIntegrationsByGiteaRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

type IssueEditedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string | null;
    updated_at?: string;
    html_url: string;
  };
  changes?: {
    title?: { from: string };
    body?: { from: string };
  };
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

export async function handleGiteaIssueEdited(
  payload: IssueEditedPayload,
  integrationId?: string,
) {
  const { issue, repository, changes } = payload;

  if (!changes?.title && !changes?.body) {
    return;
  }

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) return;

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
    repository.name,
    integrationId,
  );

  for (const integration of integrations) {
    const externalLink = await findExternalLink(
      integration.id,
      "issue",
      issue.number.toString(),
    );

    if (!externalLink) {
      continue;
    }

    const echoMetadata = externalLink.metadata
      ? JSON.parse(externalLink.metadata)
      : {};
    const fetchCurrentIssue = async () => {
      const config = JSON.parse(integration.config) as GiteaConfig;
      return createGiteaClient(config).getIssue(
        config.repositoryOwner,
        config.repositoryName,
        issue.number,
      );
    };
    let current: ReturnType<typeof fetchCurrentIssue> | undefined;
    const currentIssue = () => (current ??= fetchCurrentIssue());
    // Read the provider before taking task/project locks.
    const titleEcho = changes.title
      ? await confirmedOutboundEcho(
          echoMetadata.lastSync?.title,
          issue.title,
          issue.updated_at,
          async () => (await currentIssue()).title,
        )
      : false;
    const descriptionEcho = changes.body
      ? await confirmedOutboundEcho(
          echoMetadata.lastSync?.description,
          formatTaskDescriptionFromIssue(issue.body, externalLink.taskId),
          issue.updated_at,
          async () =>
            formatTaskDescriptionFromIssue(
              (await currentIssue()).body ?? null,
              externalLink.taskId,
            ),
        )
      : false;

    // Prepare provider confirmation before the locked reread, including stamps
    // that may be committed between the initial snapshot and this transaction.
    if ((changes.title && !titleEcho) || (changes.body && !descriptionEcho))
      await currentIssue();

    await withIntegrationTask(externalLink.taskId, integration, async (db) => {
      const task = await db.query.taskTable.findFirst({
        where: linkedTaskScope(externalLink.taskId, integration.projectId),
      });

      if (!task) {
        return;
      }

      const lockedLink = await lockExternalLink(externalLink.id, db);
      if (!lockedLink) return;
      const metadata = lockedLink.metadata
        ? JSON.parse(lockedLink.metadata)
        : {};

      const updateData: Record<string, unknown> = {};
      const updatedMetadata = { ...metadata };

      if (!updatedMetadata.lastSync) {
        updatedMetadata.lastSync = {};
      }

      if (changes.title) {
        const lastTitleSync = metadata.lastSync?.title;

        let shouldUpdateTitle = true;

        if (lastTitleSync) {
          if (
            titleEcho ||
            (await confirmedOutboundEcho(
              lastTitleSync,
              issue.title,
              issue.updated_at,
              async () => (await currentIssue()).title,
            ))
          ) {
            shouldUpdateTitle = false;
          }
        }

        if (shouldUpdateTitle) {
          updateData.title = issue.title;
          updatedMetadata.lastSync.title = {
            outbound: metadata.lastSync?.title?.outbound,
            timestamp: new Date().toISOString(),
            source: "gitea",
            value: issue.title,
          };
        }
      }

      if (changes.body) {
        const lastDescSync = metadata.lastSync?.description;
        const formattedDescription = formatTaskDescriptionFromIssue(
          issue.body,
          externalLink.taskId,
        );

        let shouldUpdateDescription = true;

        if (lastDescSync) {
          if (
            descriptionEcho ||
            (await confirmedOutboundEcho(
              lastDescSync,
              formattedDescription,
              issue.updated_at,
              async () =>
                formatTaskDescriptionFromIssue(
                  (await currentIssue()).body ?? null,
                  task.id,
                ),
            ))
          ) {
            shouldUpdateDescription = false;
          }
        }

        if (shouldUpdateDescription) {
          updateData.description = formattedDescription;
          updatedMetadata.lastSync.description = {
            outbound: metadata.lastSync?.description?.outbound,
            timestamp: new Date().toISOString(),
            source: "gitea",
            value: formattedDescription,
          };
        }
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(taskTable)
          .set(updateData)
          .where(linkedTaskScope(task.id, integration.projectId));

        await updateExternalLink(
          externalLink.id,
          {
            title: issue.title,
            metadata: updatedMetadata,
          },
          db,
        );
      }

      return;
    });
  }
}
