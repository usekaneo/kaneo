import { eq } from "drizzle-orm";
import db from "../../../database";
import { taskTable } from "../../../database/schema";
import { findExternalLink, updateExternalLink } from "../services/link-manager";
import { findIntegrationByRepo } from "../services/task-service";
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

  // Early exit if no relevant changes
  if (!changes?.title && !changes?.body) {
    console.log(
      `Issue #${issue.number} edited but no title/body changes detected`,
    );
    return;
  }

  const integration = await findIntegrationByRepo(
    repository.owner.login,
    repository.name,
  );

  if (!integration) {
    console.log(
      `No integration found for ${repository.owner.login}/${repository.name}`,
    );
    return;
  }

  const externalLink = await findExternalLink(
    integration.id,
    "issue",
    issue.number.toString(),
  );

  if (!externalLink) {
    console.log(`No linked task found for issue #${issue.number}`);
    return;
  }

  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, externalLink.taskId),
  });

  if (!task) {
    console.error(`Task ${externalLink.taskId} not found`);
    return;
  }

  const metadata = externalLink.metadata
    ? JSON.parse(externalLink.metadata)
    : {};

  const updateData: Record<string, unknown> = {};
  const updatedMetadata = { ...metadata };

  // Initialize lastSync if not present
  if (!updatedMetadata.lastSync) {
    updatedMetadata.lastSync = {};
  }

  // Handle title change
  if (changes.title) {
    const lastTitleSync = metadata.lastSync?.title;

    // LOOP PREVENTION
    let shouldUpdateTitle = true;

    if (lastTitleSync) {
      // Skip if this value was just synced from Kaneo
      if (
        lastTitleSync.value === issue.title &&
        lastTitleSync.source === "kaneo"
      ) {
        console.log("Skipping title update - already synced from Kaneo");
        shouldUpdateTitle = false;
      }

      // Skip if recent sync (within 2 seconds)
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

  // Handle description change
  if (changes.body) {
    const lastDescSync = metadata.lastSync?.description;
    const formattedDescription = formatTaskDescriptionFromIssue(issue.body);

    // LOOP PREVENTION
    let shouldUpdateDescription = true;

    if (lastDescSync) {
      // Skip if this value was just synced from Kaneo
      if (
        lastDescSync.value === formattedDescription &&
        lastDescSync.source === "kaneo"
      ) {
        console.log("Skipping description update - already synced from Kaneo");
        shouldUpdateDescription = false;
      }

      // Skip if recent sync (within 2 seconds)
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

  // Apply updates if any
  if (Object.keys(updateData).length > 0) {
    await db.update(taskTable).set(updateData).where(eq(taskTable.id, task.id));

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
}
