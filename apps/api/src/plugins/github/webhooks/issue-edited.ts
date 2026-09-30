import { issueEditScope } from "../utils/deferred-issue-edit";
import { deferIssueEdit } from "../services/deferred-issue-edits";
import { inboundStamp } from "../../github/utils/sync-echo";
import { publishEvent } from "../../../events";
import { withIntegrationLink } from "../services/with-integration-link";
import type { GitHubConfig } from "../config";
import { getVerifiedInstallationOctokit } from "../utils/github-app";
import { inboundEcho, withEchoConfirmation } from "../utils/inbound-echo";
import { linkedTaskScope } from "../services/integration-task-scope";
import { taskTable } from "../../../database/schema";
import { findExternalLink, updateExternalLink } from "../services/link-manager";
import { findAllIntegrationsByRepo } from "../services/task-service";
import { formatTaskDescriptionFromIssue } from "../utils/format";
import { parseLinkMetadata } from "../utils/parse-link-metadata";

// What this handler reads back out of the row. Every field is optional,
// because the row may predate any of them.
type SyncStamp = import("../utils/sync-echo").SyncStamp;

type IssueEditedMetadata = {
  lastSync?: {
    title?: SyncStamp;
    description?: SyncStamp;
  };
};

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
    title?: {
      from: string;
    };
    body?: {
      from: string;
    };
  };
  installation?: { id: number };
  repository: {
    id: number;
    owner: { login: string };
    name: string;
    full_name: string;
  };
};

export async function handleIssueEdited(payload: IssueEditedPayload) {
  const { issue, changes } = payload;

  if (!changes?.title && !changes?.body) {
    console.log(
      `Issue #${issue.number} edited but no title/body changes detected`,
    );
    return;
  }

  const integrations = await findAllIntegrationsByRepo(payload);

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
      const config = JSON.parse(integration.config) as GitHubConfig;
      const octokit = await getVerifiedInstallationOctokit(config);
      return (
        await octokit.rest.issues.get({
          owner: config.repositoryOwner,
          repo: config.repositoryName,
          issue_number: issue.number,
        })
      ).data;
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
              console.error(`Task ${externalLink.taskId} not found`);
              return;
            }
            const metadata = parseLinkMetadata<IssueEditedMetadata>(
              externalLink.metadata,
              {
                externalLinkId: externalLink.id,
                source: "issue_edited",
              },
            );

            const updateData: Record<string, unknown> = {};
            const updatedMetadata: IssueEditedMetadata = { ...metadata };

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
                  console.log(
                    "Skipping title update - already synced from Kaneo",
                  );
                  shouldUpdateTitle = false;
                }
              }

              if (shouldUpdateTitle) {
                updateData.title = issue.title;
                updatedMetadata.lastSync.title = inboundStamp(
                  metadata.lastSync?.title,
                  issue.title,
                  "github",
                  issue.updated_at,
                );
                console.log(
                  `Updating task title from GitHub: "${changes.title.from}" → "${issue.title}"`,
                );
              }
            }

            if (changes.body) {
              const lastDescSync = metadata.lastSync?.description;
              const formattedDescription = formatTaskDescriptionFromIssue(
                issue.body,
                task.id,
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
                  console.log(
                    "Skipping description update - already synced from Kaneo",
                  );
                  shouldUpdateDescription = false;
                }
              }

              if (shouldUpdateDescription) {
                updateData.description = formattedDescription;
                updatedMetadata.lastSync.description = inboundStamp(
                  metadata.lastSync?.description,
                  formattedDescription,
                  "github",
                  issue.updated_at,
                );
                console.log("Updating task description from GitHub");
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

              console.log(
                `Synced ${Object.keys(updateData).join(", ")} from GitHub issue #${issue.number} to task ${task.id}`,
              );
            } else {
              console.log(
                `No updates needed for task ${task.id} from issue #${issue.number}`,
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
