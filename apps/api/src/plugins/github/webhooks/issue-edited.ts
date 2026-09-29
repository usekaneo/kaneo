import type { GitHubConfig } from "../config";
import { getVerifiedInstallationOctokit } from "../utils/github-app";
import { confirmedOutboundEcho } from "../utils/sync-echo";
import {
  linkedTaskScope,
  withIntegrationTask,
} from "../services/integration-task-scope";
import { taskTable } from "../../../database/schema";
import {
  findExternalLink,
  updateExternalLink,
  lockExternalLink,
} from "../services/link-manager";
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

    const echoMetadata = parseLinkMetadata<IssueEditedMetadata>(
      externalLink.metadata,
      { externalLinkId: externalLink.id, source: "issue_edited" },
    );
    const fetchCurrentIssue = async () => {
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
        console.error(`Task ${externalLink.taskId} not found`);
        return;
      }

      const lockedLink = await lockExternalLink(externalLink.id, db);
      if (!lockedLink) return;
      const metadata = parseLinkMetadata<IssueEditedMetadata>(
        lockedLink.metadata,
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
            titleEcho ||
            (await confirmedOutboundEcho(
              lastTitleSync,
              issue.title,
              issue.updated_at,
              async () => (await currentIssue()).title,
            ))
          ) {
            console.log("Skipping title update - already synced from Kaneo");
            shouldUpdateTitle = false;
          }
        }

        if (shouldUpdateTitle) {
          updateData.title = issue.title;
          updatedMetadata.lastSync.title = {
            outbound: metadata.lastSync?.title?.outbound,
            timestamp: new Date().toISOString(),
            source: "github",
            value: issue.title,
          };
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
            console.log(
              "Skipping description update - already synced from Kaneo",
            );
            shouldUpdateDescription = false;
          }
        }

        if (shouldUpdateDescription) {
          updateData.description = formattedDescription;
          updatedMetadata.lastSync.description = {
            outbound: metadata.lastSync?.description?.outbound,
            timestamp: new Date().toISOString(),
            source: "github",
            value: formattedDescription,
          };
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

        console.log(
          `Synced ${Object.keys(updateData).join(", ")} from GitHub issue #${issue.number} to task ${task.id}`,
        );
      } else {
        console.log(
          `No updates needed for task ${task.id} from issue #${issue.number}`,
        );
      }

      return;
    });
  }
}
