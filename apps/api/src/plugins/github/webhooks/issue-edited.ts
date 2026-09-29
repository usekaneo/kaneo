import { isOutboundEcho } from "../utils/sync-echo";
import {
  linkedTaskScope,
  withIntegrationTask,
} from "../services/integration-task-scope";
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

    await withIntegrationTask(externalLink.taskId, integration, async (db) => {
      const task = await db.query.taskTable.findFirst({
        where: linkedTaskScope(externalLink.taskId, integration.projectId),
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
          if (isOutboundEcho(lastTitleSync, issue.title, issue.updated_at)) {
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
            isOutboundEcho(lastDescSync, formattedDescription, issue.updated_at)
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
