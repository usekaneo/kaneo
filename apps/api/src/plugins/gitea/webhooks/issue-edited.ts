import { publishEvent } from "../../../events";
import { withIntegrationLink } from "../../github/services/with-integration-link";
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

    await withIntegrationLink(
      externalLink,
      integration,
      async (db, afterCommit, externalLink) => {
        const task = await db.query.taskTable.findFirst({
          where: linkedTaskScope(externalLink.taskId, integration.projectId),
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
              lastTitleSync.value === issue.title &&
              lastTitleSync.source === "kaneo"
            ) {
              shouldUpdateTitle = false;
            }
            const timeSinceLastSync =
              Date.now() - new Date(lastTitleSync.timestamp).getTime();
            if (timeSinceLastSync < 2000 && shouldUpdateTitle) {
              shouldUpdateTitle = false;
            }
          }

          if (shouldUpdateTitle) {
            updateData.title = issue.title;
            updatedMetadata.lastSync.title = {
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
          );

          let shouldUpdateDescription = true;

          if (lastDescSync) {
            if (
              lastDescSync.value === formattedDescription &&
              lastDescSync.source === "kaneo"
            ) {
              shouldUpdateDescription = false;
            }
            const timeSinceLastSync =
              Date.now() - new Date(lastDescSync.timestamp).getTime();
            if (timeSinceLastSync < 2000 && shouldUpdateDescription) {
              shouldUpdateDescription = false;
            }
          }

          if (shouldUpdateDescription) {
            updateData.description = formattedDescription;
            updatedMetadata.lastSync.description = {
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
          afterCommit(() =>
            publishEvent("task.updated", {
              projectId: integration.projectId,
              taskId: externalLink.taskId,
            }),
          );
        }

        return;
      },
    );
  }
}
