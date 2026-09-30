import { issueEditScope } from "../../github/utils/deferred-issue-edit";
import { deferIssueEdit } from "../../github/services/deferred-issue-edits";
import { inboundStamp } from "../../github/utils/sync-echo";
import { publishEvent } from "../../../events";
import { withIntegrationLink } from "../../github/services/with-integration-link";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";
import {
  inboundEcho,
  withEchoConfirmation,
} from "../../github/utils/inbound-echo";
import { linkedTaskScope } from "../../github/services/integration-task-scope";
import { taskTable } from "../../../database/schema";
import {
  findExternalLink,
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

    const readCurrent = async () => {
      const config = JSON.parse(integration.config) as GiteaConfig;
      return await createGiteaClient(config).getIssue(
        config.repositoryOwner,
        config.repositoryName,
        issue.number,
      );
    };
    await withEchoConfirmation(
      readCurrent,
      (current, confirmation) =>
        withIntegrationLink(
          externalLink,
          integration,
          async (db, afterCommit, externalLink) => {
            const task = await db.query.taskTable.findFirst({
              where: linkedTaskScope(
                externalLink.taskId,
                integration.projectId,
              ),
            });

            if (!task) {
              return;
            }
            const metadata = externalLink.metadata
              ? JSON.parse(externalLink.metadata)
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
                  inboundEcho(
                    lastTitleSync,
                    issue.title,
                    issue.updated_at,
                    current?.title,
                    {
                      linkId: externalLink.id,
                      field: "title",
                      localValue: task.title,
                      confirmation,
                    },
                  )
                ) {
                  shouldUpdateTitle = false;
                }
              }

              if (shouldUpdateTitle) {
                updateData.title = issue.title;
                updatedMetadata.lastSync.title = inboundStamp(
                  metadata.lastSync?.title,
                  issue.title,
                  "gitea",
                  issue.updated_at,
                );
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
                  inboundEcho(
                    lastDescSync,
                    formattedDescription,
                    issue.updated_at,
                    current
                      ? formatTaskDescriptionFromIssue(
                          current.body ?? null,
                          task.id,
                        )
                      : undefined,
                    {
                      linkId: externalLink.id,
                      field: "description",
                      localValue: task.description || "",
                      confirmation,
                    },
                  )
                ) {
                  shouldUpdateDescription = false;
                }
              }

              if (shouldUpdateDescription) {
                updateData.description = formattedDescription;
                updatedMetadata.lastSync.description = inboundStamp(
                  metadata.lastSync?.description,
                  formattedDescription,
                  "gitea",
                  issue.updated_at,
                );
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
              afterCommit(() =>
                publishEvent("task.updated", {
                  projectId: integration.projectId,
                  taskId: externalLink.taskId,
                }),
              );
            }

            return;
          },
          {
            validate: (binding) =>
              issueEditScope(binding) === issueEditScope(integration),
          },
        ),
      () =>
        deferIssueEdit(externalLink, integration, [
          ...(changes.title ? ["title" as const] : []),
          ...(changes.body ? ["description" as const] : []),
        ]),
    );
  }
}
