/**
 * @fileoverview Create Gitea Integration Controller
 * Handles creation and updates of Gitea integrations with optimized database operations
 * and comprehensive error handling with retry logic
 */

import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { giteaIntegrationTable, projectTable } from "../../database/schema";

/**
 * Retry configuration for database operations
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 100, // milliseconds
  maxDelay: 1000,
} as const;

/**
 * Execute database operation with exponential backoff retry
 * @param operation - Database operation to retry
 * @param context - Operation context for logging
 * @returns Operation result
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `${context} failed (attempt ${attempt}/${RETRY_CONFIG.maxAttempts}):`,
        error,
      );

      // Don't retry on the last attempt
      if (attempt === RETRY_CONFIG.maxAttempts) {
        break;
      }

      // Calculate exponential backoff delay
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * 2 ** (attempt - 1),
        RETRY_CONFIG.maxDelay,
      );

      console.log(`Retrying ${context} in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.error(
    `${context} failed after ${RETRY_CONFIG.maxAttempts} attempts:`,
    lastError,
  );
  throw lastError;
}

/**
 * Create or update Gitea integration with optimized database operations
 * Uses single query to check project existence and get existing integration
 *
 * @param params - Integration configuration parameters
 * @returns Created or updated integration
 *
 * @throws {HTTPException} 404 if project not found
 * @throws {HTTPException} 400 if webhook secret is too short
 *
 * @performance
 * - Uses LEFT JOIN to get project and existing integration in single query
 * - Retry logic with exponential backoff for database operations
 * - Optimized validation with early returns
 */

async function createGiteaIntegration({
  projectId,
  giteaUrl,
  repositoryOwner,
  repositoryName,
  accessToken,
  webhookSecret,
}: {
  projectId: string;
  giteaUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  accessToken: string;
  webhookSecret?: string;
}) {
  // Early validation - webhook secret security requirement
  if (webhookSecret && webhookSecret.length < 32) {
    throw new HTTPException(400, {
      message:
        "Webhook secret must be at least 32 characters long for security",
    });
  }

  // Optimized query: Get project and existing integration in single LEFT JOIN query
  const result = await withRetry(async () => {
    return db
      .select({
        projectId: projectTable.id,
        projectExists: projectTable.id,
        integrationId: giteaIntegrationTable.id,
        integrationExists: giteaIntegrationTable.id,
      })
      .from(projectTable)
      .leftJoin(
        giteaIntegrationTable,
        eq(giteaIntegrationTable.projectId, projectTable.id),
      )
      .where(eq(projectTable.id, projectId))
      .limit(1);
  }, "Get project and integration data");

  const data = result[0];

  // Project validation
  if (!data?.projectExists) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  // Update existing integration with retry logic
  if (data.integrationExists) {
    const [updatedIntegration] = await withRetry(async () => {
      return db
        .update(giteaIntegrationTable)
        .set({
          giteaUrl,
          repositoryOwner,
          repositoryName,
          accessToken,
          webhookSecret,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(giteaIntegrationTable.projectId, projectId))
        .returning();
    }, "Update existing Gitea integration");

    return updatedIntegration;
  }

  // Create new integration with retry logic
  const [newIntegration] = await withRetry(async () => {
    return db
      .insert(giteaIntegrationTable)
      .values({
        projectId,
        giteaUrl,
        repositoryOwner,
        repositoryName,
        accessToken,
        webhookSecret,
        isActive: true,
      })
      .returning();
  }, "Create new Gitea integration");

  return newIntegration;
}

export default createGiteaIntegration;
