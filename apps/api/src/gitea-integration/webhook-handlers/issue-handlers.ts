import { and, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import db from "../../database";
import {
  externalLinksTable,
  type giteaIntegrationTable,
  taskTable,
} from "../../database/schema";
import { createIntegrationLinkHybrid } from "../../external-links/hybrid-integration-utils";
import createTask from "../../task/controllers/create-task";
import deleteTask from "../../task/controllers/delete-task";
import updateTask from "../../task/controllers/update-task";
import { cleanKaneoMetadata, parseKaneoTaskId } from "../utils/issue-templates";
import type { GiteaIssueWebhookPayload } from "./webhook-processor";

type GiteaIntegration = InferSelectModel<typeof giteaIntegrationTable>;

/**
 * Task structure as returned from database queries
 */
interface TaskFromDB {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  dueDate: Date | null;
  position: number | null;
  userEmail: string | null;
}

/**
 * Map Gitea issue state to Kaneo task status with validation
 * @param state - Gitea issue state ("open" | "closed")
 * @returns Corresponding Kaneo task status
 * @throws Error if state is invalid
 */
function mapGiteaStateToKaneoStatus(state: "open" | "closed"): string {
  switch (state) {
    case "closed":
      return "done";
    case "open":
      return "to-do";
    default:
      throw new Error(
        `Invalid Gitea issue state: ${state}. Expected "open" or "closed"`,
      );
  }
}

/**
 * Handle new Gitea issue creation - creates corresponding Kaneo task
 * Implements comprehensive loop prevention and error handling
 * @param payload - Gitea webhook payload for issue opened event
 * @param integration - Gitea integration configuration
 */
export async function handleIssueOpened(
  payload: GiteaIssueWebhookPayload,
  integration: GiteaIntegration,
) {
  try {
    console.log(
      `Processing Gitea issue opened: #${payload.issue.number} in ${payload.repository.full_name}`,
    );

    // Enhanced loop prevention: Check for Kaneo metadata or title prefix
    const kaneoTaskId = parseKaneoTaskId(payload.issue.body);
    const hasKaneoPrefix = payload.issue.title.includes("[Kaneo]");

    if (kaneoTaskId || hasKaneoPrefix) {
      console.log(
        `Issue #${payload.issue.number} appears to be created by Kaneo (taskId: ${kaneoTaskId}, hasPrefix: ${hasKaneoPrefix}), skipping to avoid duplicate`,
      );
      return;
    }

    // Validate required payload data before processing
    if (!payload.issue.title?.trim()) {
      throw new Error(
        `Issue #${payload.issue.number} has empty title - cannot create task`,
      );
    }

    // Check if task already exists for this issue to prevent duplicates
    const existingLink = await db.query.externalLinksTable.findFirst({
      where: and(
        eq(externalLinksTable.type, "gitea_integration"),
        eq(externalLinksTable.externalId, payload.issue.number.toString()),
        eq(externalLinksTable.url, payload.issue.html_url),
      ),
    });

    if (existingLink) {
      console.log(
        `Task already exists for Gitea issue #${payload.issue.number}, skipping`,
      );
      return;
    }

    // Create new task from Gitea issue
    const cleanDescription = cleanKaneoMetadata(payload.issue.body);
    const status = mapGiteaStateToKaneoStatus(payload.issue.state);

    const newTask = await createTask({
      projectId: integration.projectId,
      title: payload.issue.title,
      description: cleanDescription || "No description provided", // Don't use "Created from Gitea issue"
      status,
      priority: "medium", // Default priority
      userEmail: undefined, // No assignee initially
    });

    // Create external link
    await createIntegrationLinkHybrid({
      taskId: newTask.id,
      type: "gitea_integration",
      title: `Gitea Issue #${payload.issue.number}`,
      url: payload.issue.html_url,
      externalId: payload.issue.number.toString(),
    });

    console.log(
      `Successfully created task ${newTask.id} from Gitea issue #${payload.issue.number}`,
    );
  } catch (error) {
    console.error("Failed to handle Gitea issue opened:", error);
    throw error;
  }
}

/**
 * Handle Gitea issue state changes (closed/reopened)
 * Updates the corresponding task status in Kaneo
 */
export async function handleIssueStateChanged(
  payload: GiteaIssueWebhookPayload,
  _integration: GiteaIntegration,
) {
  try {
    console.log(
      `Processing Gitea issue state change: #${payload.issue.number} -> ${payload.issue.state}`,
    );

    // Find the linked task
    const linkedTask = await findLinkedTask(
      payload.issue.number,
      payload.issue.html_url,
    );

    if (!linkedTask) {
      console.log(
        `No linked task found for Gitea issue #${payload.issue.number}, skipping`,
      );
      return;
    }

    const newStatus = mapGiteaStateToKaneoStatus(payload.issue.state);

    // Only update if status actually changed
    if (linkedTask.status === newStatus) {
      console.log(
        `Task ${linkedTask.id} already has status ${newStatus}, skipping`,
      );
      return;
    }

    // Update task status
    await updateTask(
      linkedTask.id,
      linkedTask.title,
      newStatus,
      linkedTask.dueDate || new Date(),
      linkedTask.projectId,
      linkedTask.description || "",
      linkedTask.priority || "medium",
      linkedTask.position || 0,
      linkedTask.userEmail || undefined,
    );

    console.log(
      `Successfully updated task ${linkedTask.id} status to ${newStatus} from Gitea issue #${payload.issue.number}`,
    );
  } catch (error) {
    console.error("Failed to handle Gitea issue state change:", error);
    throw error;
  }
}

/**
 * Handle Gitea issue content updates (title/description)
 * Updates the corresponding task in Kaneo
 */
export async function handleIssueEdited(
  payload: GiteaIssueWebhookPayload,
  _integration: GiteaIntegration,
) {
  try {
    console.log(`Processing Gitea issue edit: #${payload.issue.number}`);

    // Find the linked task
    const linkedTask = await findLinkedTask(
      payload.issue.number,
      payload.issue.html_url,
    );

    if (!linkedTask) {
      console.log(
        `No linked task found for Gitea issue #${payload.issue.number}, skipping`,
      );
      return;
    }

    // Option 1: Allow bidirectional description updates (default: true)
    // Set to false to fallback to Option 2 (ignore description updates from Gitea)
    const allowBidirectionalDescriptions = true;

    if (!allowBidirectionalDescriptions) {
      console.log(
        `Bidirectional description updates disabled, skipping description update for task ${linkedTask.id}`,
      );
      return;
    }

    // Clean the issue body from Kaneo metadata
    const cleanDescription = cleanKaneoMetadata(payload.issue.body);

    // Update task with new content
    await updateTask(
      linkedTask.id,
      payload.issue.title,
      linkedTask.status,
      linkedTask.dueDate || new Date(),
      linkedTask.projectId,
      cleanDescription,
      linkedTask.priority || "medium",
      linkedTask.position || 0,
      linkedTask.userEmail || undefined,
      "gitea_webhook", // Add source to prevent loops
    );

    console.log(
      `Successfully updated task ${linkedTask.id} content from Gitea issue #${payload.issue.number}`,
    );
  } catch (error) {
    console.error("Failed to handle Gitea issue edit:", error);
    throw error;
  }
}

/**
 * Handle Gitea issue deletion
 * Deletes the corresponding task in Kaneo
 */
export async function handleIssueDeleted(
  payload: GiteaIssueWebhookPayload,
  _integration: GiteaIntegration,
) {
  try {
    console.log(`Processing Gitea issue deletion: #${payload.issue.number}`);

    // Find the linked task
    const linkedTask = await findLinkedTask(
      payload.issue.number,
      payload.issue.html_url,
    );

    if (!linkedTask) {
      console.log(
        `No linked task found for Gitea issue #${payload.issue.number}, skipping`,
      );
      return;
    }

    // Delete the task (external link will be cascade deleted)
    await deleteTask(linkedTask.id);

    console.log(
      `Successfully deleted task ${linkedTask.id} from Gitea issue #${payload.issue.number} deletion`,
    );
  } catch (error) {
    console.error("Failed to handle Gitea issue deletion:", error);
    throw error;
  }
}

/**
 * Find task linked to a Gitea issue
 */
async function findLinkedTask(
  issueNumber: number,
  issueUrl: string,
): Promise<TaskFromDB | null> {
  // First try to find via external link
  const link = await db.query.externalLinksTable.findFirst({
    where: and(
      eq(externalLinksTable.type, "gitea_integration"),
      eq(externalLinksTable.externalId, issueNumber.toString()),
      eq(externalLinksTable.url, issueUrl),
    ),
  });

  if (!link) {
    return null;
  }

  // Get the task associated with the link
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, link.taskId),
  });

  return task || null;
}

/**
 * Main webhook handler for Gitea issue events
 */
export async function handleIssueWebhook(
  payload: GiteaIssueWebhookPayload,
  integration: GiteaIntegration,
) {
  switch (payload.action) {
    case "opened":
      return handleIssueOpened(payload, integration);

    case "closed":
    case "reopened":
      return handleIssueStateChanged(payload, integration);

    case "edited":
      return handleIssueEdited(payload, integration);

    case "deleted":
      return handleIssueDeleted(payload, integration);

    default:
    // Ignore unhandled actions
  }
}
