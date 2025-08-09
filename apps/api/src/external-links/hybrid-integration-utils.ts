/**
 * @fileoverview Hybrid Integration Utilities
 * Provides backward compatibility between legacy description-based links
 * and the new external_links table system
 *
 * @description This module handles the transition from storing integration links
 * in task descriptions to the dedicated external_links table, ensuring
 * seamless operation during migration periods.
 *
 * @performance
 * - Uses database JOINs to minimize round trips
 * - Implements efficient lookup patterns for hybrid compatibility
 * - Caches frequently accessed link data
 */

import { and, eq } from "drizzle-orm";
import db from "../database";
import { externalLinksTable, taskTable } from "../database/schema";

/**
 * Parameters for creating integration links
 *
 * @example Creating a Gitea integration link
 * ```typescript
 * const linkParams: IntegrationLinkParams = {
 *   taskId: "task_abc123",
 *   type: "gitea_integration",
 *   title: "Gitea Issue #42",
 *   url: "https://gitea.example.com/user/repo/issues/42",
 *   externalId: "42"
 * };
 * ```
 */
interface IntegrationLinkParams {
  /** Kaneo task ID to link */
  taskId: string;
  /** Integration type identifier */
  type: "gitea_integration" | "github_integration";
  /** Human-readable link title */
  title: string;
  /** Full URL to the external resource */
  url: string;
  /** External system identifier (issue number, etc.) */
  externalId: string;
}

/**
 * Parameters for retrieving integration links
 *
 * @example Getting a link for a task
 * ```typescript
 * const linkParams: GetIntegrationLinkParams = {
 *   taskId: "task_abc123",
 *   type: "gitea_integration"
 * };
 * const link = await getIntegrationLinkHybrid(linkParams);
 * ```
 */
interface GetIntegrationLinkParams {
  /** Task ID to search for links */
  taskId: string;
  /** Integration type to filter by */
  type: "gitea_integration" | "github_integration";
}

/**
 * Cache entry structure for integration links
 */
interface CacheEntry {
  data: {
    id: string;
    issueNumber: string | null;
    issueUrl: string | null;
    source: "external_links" | "description";
  } | null;
  timestamp: number;
  ttl: number;
}

/**
 * Cache for frequently accessed integration links to improve performance
 * Key format: `${taskId}-${type}`
 */
const linkCache = new Map<string, CacheEntry>();

const CACHE_TTL = 300000; // 5 minutes in milliseconds

/**
 * Hybrid function that works with both new external_links table and legacy description-based links
 * Provides seamless backward compatibility during migration period
 *
 * @param params - Link retrieval parameters
 * @returns Integration link data or null if not found
 *
 * @example Basic usage
 * ```typescript
 * const link = await getIntegrationLinkHybrid({
 *   taskId: "task_123",
 *   type: "gitea_integration"
 * });
 *
 * if (link) {
 *   console.log(`Found ${link.source} link: ${link.issueUrl}`);
 * }
 * ```
 *
 * @performance
 * - Uses caching for frequently accessed links
 * - Minimizes database queries through efficient lookups
 * - Falls back gracefully to legacy parsing when needed
 */
export async function getIntegrationLinkHybrid(
  params: GetIntegrationLinkParams,
) {
  try {
    // Check cache first for performance optimization
    const cacheKey = `${params.taskId}-${params.type}`;
    const cached = linkCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Optimized query: try to get external link and task data in single query
    const result = await db
      .select({
        linkId: externalLinksTable.id,
        linkUrl: externalLinksTable.url,
        linkExternalId: externalLinksTable.externalId,
        taskDescription: taskTable.description,
      })
      .from(externalLinksTable)
      .rightJoin(taskTable, eq(externalLinksTable.taskId, taskTable.id))
      .where(
        and(
          eq(taskTable.id, params.taskId),
          eq(externalLinksTable.type, params.type),
        ),
      )
      .limit(1);

    const data = result[0];

    // If external link exists, return it
    if (data?.linkId) {
      const linkData = {
        id: data.linkId,
        issueNumber: data.linkExternalId,
        issueUrl: data.linkUrl,
        source: "external_links" as const,
      };

      // Cache the result
      linkCache.set(cacheKey, {
        data: linkData,
        timestamp: Date.now(),
        ttl: CACHE_TTL,
      });

      return linkData;
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
