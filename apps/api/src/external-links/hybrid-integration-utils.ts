import { and, eq } from "drizzle-orm";
import db from "../database";
import { externalLinksTable, taskTable } from "../database/schema";

interface IntegrationLinkParams {
  taskId: string;
  type: "gitea_integration" | "github_integration";
  title: string;
  url: string;
  externalId: string;
}

interface GetIntegrationLinkParams {
  taskId: string;
  type: "gitea_integration" | "github_integration";
}

/**
 * Hybrid function that works with both new external_links table and legacy description-based links
 * For GitHub: Falls back to description parsing if no external link found
 * For Gitea: Only uses external_links (new system)
 */
export async function getIntegrationLinkHybrid(
  params: GetIntegrationLinkParams,
) {
  try {
    // First, try to get from external_links table
    const [externalLink] = await db
      .select()
      .from(externalLinksTable)
      .where(
        and(
          eq(externalLinksTable.taskId, params.taskId),
          eq(externalLinksTable.type, params.type),
        ),
      )
      .limit(1);

    if (externalLink) {
      return {
        id: externalLink.id,
        issueNumber: externalLink.externalId,
        issueUrl: externalLink.url,
        source: "external_links" as const,
      };
    }

    // For GitHub only: Fall back to description parsing (legacy support)
    if (params.type === "github_integration") {
      const task = await db.query.taskTable.findFirst({
        where: eq(taskTable.id, params.taskId),
      });

      if (task?.description) {
        const linkPatterns = [
          /Linked to GitHub issue: (https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+))/,
          /Created from GitHub issue: (https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+))/,
        ];

        for (const pattern of linkPatterns) {
          const match = task.description.match(pattern);
          if (match) {
            return {
              id: null, // No external link ID for legacy links
              issueNumber: match[2],
              issueUrl: match[1],
              source: "description" as const,
            };
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`Error getting ${params.type} link:`, error);
    return null;
  }
}

/**
 * Create or update integration link using the new external_links system
 * Also migrates legacy description-based links when found
 */
export async function createIntegrationLinkHybrid(
  params: IntegrationLinkParams,
) {
  try {
    // Check if there's already an external link
    const existingLink = await getIntegrationLinkHybrid({
      taskId: params.taskId,
      type: params.type,
    });

    if (existingLink?.source === "external_links") {
      // Update existing external link
      const [updatedLink] = await db
        .update(externalLinksTable)
        .set({
          title: params.title,
          url: params.url,
          externalId: params.externalId,
        })
        .where(eq(externalLinksTable.id, existingLink.id))
        .returning();

      return updatedLink;
    }

    if (existingLink?.source === "description") {
      // Migrate from description to external_links
      console.log(
        `Migrating ${params.type} link from description to external_links for task ${params.taskId}`,
      );

      const [newLink] = await db
        .insert(externalLinksTable)
        .values({
          taskId: params.taskId,
          type: params.type,
          title: params.title,
          url: params.url,
          externalId: params.externalId,
          createdBy: null, // System-created link
        })
        .returning();

      // Clean up description (remove the old link footer)
      await migrateLegacyLinkFromDescription(params.taskId, params.type);

      return newLink;
    }

    // Create new external link
    const [newLink] = await db
      .insert(externalLinksTable)
      .values({
        taskId: params.taskId,
        type: params.type,
        title: params.title,
        url: params.url,
        externalId: params.externalId,
        createdBy: null, // System-created link
      })
      .returning();

    return newLink;
  } catch (error) {
    console.error(`Error creating ${params.type} link:`, error);
    throw error;
  }
}

/**
 * Remove legacy link from task description
 */
async function migrateLegacyLinkFromDescription(
  taskId: string,
  type: "gitea_integration" | "github_integration",
) {
  try {
    const task = await db.query.taskTable.findFirst({
      where: eq(taskTable.id, taskId),
    });

    if (!task?.description) return;

    let updatedDescription = task.description;

    if (type === "github_integration") {
      // Remove GitHub link patterns
      updatedDescription = updatedDescription
        .replace(
          /\n\n---\n\n\*Linked to GitHub issue: https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+\*/,
          "",
        )
        .replace(
          /\*Linked to GitHub issue: https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+\*/,
          "",
        )
        .replace(
          /\n\n---\n\n\*Created from GitHub issue: https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+\*/,
          "",
        )
        .replace(
          /\*Created from GitHub issue: https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/\d+\*/,
          "",
        );
    } else if (type === "gitea_integration") {
      // Remove Gitea link patterns
      updatedDescription = updatedDescription
        .replace(/\n\n---\n\n\*Linked to Gitea issue: [^\*]+\*/, "")
        .replace(/\*Linked to Gitea issue: [^\*]+\*/, "")
        .replace(/\n\n---\n\n\*Created from Gitea issue: [^\*]+\*/, "")
        .replace(/\*Created from Gitea issue: [^\*]+\*/, "");
    }

    // Only update if description changed
    if (updatedDescription !== task.description) {
      await db
        .update(taskTable)
        .set({ description: updatedDescription.trim() })
        .where(eq(taskTable.id, taskId));

      console.log(
        `Cleaned legacy ${type} link from task ${taskId} description`,
      );
    }
  } catch (error) {
    console.error(`Error migrating legacy ${type} link:`, error);
  }
}

/**
 * Delete integration link (works with both systems)
 */
export async function deleteIntegrationLinkHybrid(
  params: GetIntegrationLinkParams,
) {
  try {
    const existingLink = await getIntegrationLinkHybrid(params);

    if (existingLink?.source === "external_links" && existingLink.id) {
      const [deletedLink] = await db
        .delete(externalLinksTable)
        .where(eq(externalLinksTable.id, existingLink.id))
        .returning();

      return deletedLink;
    }

    if (existingLink?.source === "description") {
      // For legacy description-based links, just clean the description
      await migrateLegacyLinkFromDescription(params.taskId, params.type);
      return { success: true, migrated: true };
    }

    return null;
  } catch (error) {
    console.error(`Error deleting ${params.type} link:`, error);
    return null;
  }
}
