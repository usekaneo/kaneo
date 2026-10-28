import { canSyncTask } from "../../sync/eligibility";
import { syncLatestTaskValue } from "../../github/services/sync-latest-task-value";
import db from "../../../database";
import { linkedTaskScope } from "../../github/services/integration-task-scope";
import { findExternalLinksByTask } from "../../github/services/link-manager";
import type { PluginContext, TaskTitleChangedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";

type LinkSyncState = import("../../github/utils/sync-echo").SyncStamp;

type LinkMetadata = {
  lastSync?: {
    title?: LinkSyncState;
  };
  [key: string]: unknown;
};

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  if (
    !(await canSyncTask(
      event.taskId,
      context.integrationId,
      undefined,
      JSON.stringify(context.config),
    ))
  )
    return;

  const config = context.config as GiteaConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  const { repositoryOwner, repositoryName } = config;

  try {
    const current = await db.query.taskTable.findFirst({
      where: linkedTaskScope(event.taskId, context.projectId),
      columns: { title: true },
    });
    if (!current || current.title !== event.newTitle) return;

    const links = await findExternalLinksByTask(event.taskId);
    const issueLink = links.find(
      (link) =>
        link.integrationId === context.integrationId &&
        link.resourceType === "issue",
    );

    if (!issueLink) {
      return;
    }

    let metadata: LinkMetadata = {};
    if (issueLink.metadata) {
      try {
        metadata = JSON.parse(issueLink.metadata) as LinkMetadata;
      } catch (error) {
        console.warn(
          "Failed to parse Gitea issue link metadata for title sync",
          {
            issueLinkId: issueLink.id,
            taskId: issueLink.taskId,
            metadata: issueLink.metadata,
            error,
          },
        );
      }
    }

    const lastTitleSync = metadata.lastSync?.title;
    if (lastTitleSync) {
      if (
        lastTitleSync.value === event.newTitle &&
        lastTitleSync.source === "gitea"
      ) {
        console.log("Skipping title sync - already synced from Gitea");
        return;
      }
    }

    const client = createGiteaClient(config);
    const issueNumber = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueNumber)) {
      console.warn("Skipping Gitea title sync for invalid issue number", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
        taskId: issueLink.taskId,
      });
      return;
    }

    await syncLatestTaskValue(
      event.taskId,
      context.projectId,
      issueLink,
      "title",
      event.newTitle,
      async (value) => {
        const response = await client.updateIssue(
          repositoryOwner,
          repositoryName,
          issueNumber,
          {
            title: value,
          },
        );
        return response?.updated_at;
      },
      async () =>
        (await client.getIssue(repositoryOwner, repositoryName, issueNumber))
          .title,
      { type: "gitea", config: JSON.stringify(config) },
    );

    console.log(`Synced task title to Gitea issue #${issueNumber}`);
  } catch (error) {
    console.error("Failed to update Gitea issue title:", error);
  }
}
