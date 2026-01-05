import { eq } from "drizzle-orm";
import db from "../../../database";
import { taskTable } from "../../../database/schema";
import { findExternalLink, updateExternalLink } from "../services/link-manager";
import { findAllIntegrationsByRepo } from "../services/task-service";
import { formatTaskDescriptionFromIssue } from "../utils/format";

type IssueEditedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string | null;
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
  repository: {
    owner: { login: string };
    name: string;
    full_name: string;
  };
};

export async function handleIssueEdited(payload: IssueEditedPayload) {
  const { issue, repository, changes } = payload;

  if (!changes?.title && !changes?.body) {
    console.log(
      `Issue #${issue.number} edited but no title/body changes detected`,
    );
    return;
  }

  const integrations = await findAllIntegrationsByRepo(
    repository.owner.login,
    repository.name,
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

    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, externalLink.taskId),
    });

    if (!task) {
      console.error(`Task ${externalLink.taskId} not found`);
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
          console.log("Skipping title update - already synced from Kaneo");
          shouldUpdateTitle = false;
        }

        const timeSinceLastSync =
          Date.now() - new Date(lastTitleSync.timestamp).getTime();
        if (timeSinceLastSync < 2000 && shouldUpdateTitle) {
          console.log(
            `Skipping title update - recent sync detected (${timeSinceLastSync}ms ago)`,
          );
          shouldUpdateTitle = false;
        }
      }

      if (shouldUpdateTitle) {
        updateData.title = issue.title;
        updatedMetadata.lastSync.title = {
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
      const formattedDescription = formatTaskDescriptionFromIssue(issue.body);

      let shouldUpdateDescription = true;

      if (lastDescSync) {
        if (
          lastDescSync.value === formattedDescription &&
          lastDescSync.source === "kaneo"
        ) {
          console.log(
            "Skipping description update - already synced from Kaneo",
          );
          shouldUpdateDescription = false;
        }

        const timeSinceLastSync =
          Date.now() - new Date(lastDescSync.timestamp).getTime();
        if (timeSinceLastSync < 2000 && shouldUpdateDescription) {
          console.log(
            `Skipping description update - recent sync detected (${timeSinceLastSync}ms ago)`,
          );
          shouldUpdateDescription = false;
        }
      }

      if (shouldUpdateDescription) {
        updateData.description = formattedDescription;
        updatedMetadata.lastSync.description = {
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
        .where(eq(taskTable.id, task.id));

      await updateExternalLink(externalLink.id, {
        title: issue.title,
        metadata: updatedMetadata,
      });

      console.log(
        `Synced ${Object.keys(updateData).join(", ")} from GitHub issue #${issue.number} to task ${task.id}`,
      );
    } else {
      console.log(
        `No updates needed for task ${task.id} from issue #${issue.number}`,
      );
    }

    return;
  }
}
