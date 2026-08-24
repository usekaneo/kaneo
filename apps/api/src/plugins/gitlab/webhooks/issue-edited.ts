import { eq } from "drizzle-orm";
import db from "../../../database";
import { taskTable } from "../../../database/schema";
import {
  findExternalLink,
  updateExternalLink,
} from "../../github/services/link-manager";
import { formatTaskDescriptionFromIssue } from "../../github/utils/format";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type IssueEditedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    url: string;
    action: string;
  };
  changes?: {
    title?: { previous: string; current: string };
    description?: { previous: string; current: string };
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabIssueEdited(
  payload: IssueEditedPayload,
  integrationId?: string,
) {
  const { object_attributes: issue, project, changes } = payload;

  if (issue.action !== "update") {
    return;
  }
  if (!changes?.title && !changes?.description) {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  for (const integration of integrations) {
    const externalLink = await findExternalLink(
      integration.id,
      "issue",
      issue.iid.toString(),
    );

    if (!externalLink) {
      continue;
    }

    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, externalLink.taskId),
    });

    if (!task) {
      continue;
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
          source: "gitlab",
          value: issue.title,
        };
      }
    }

    if (changes.description) {
      const lastDescSync = metadata.lastSync?.description;
      const formattedDescription = formatTaskDescriptionFromIssue(
        issue.description,
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
          source: "gitlab",
          value: formattedDescription,
        };
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(taskTable)
        .set(updateData)
        .where(eq(taskTable.id, task.id));

      await updateExternalLink(externalLink.id, {
        title: issue.title,
        metadata: updatedMetadata,
      });
    }

    return;
  }
}
