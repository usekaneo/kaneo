import { and, eq } from "drizzle-orm";
import db from "../database";
import { externalLinksTable } from "../database/schema";

interface CreateIntegrationLinkParams {
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

export async function createIntegrationLink(
  params: CreateIntegrationLinkParams,
) {
  try {
    // Check if link already exists
    const existingLink = await getIntegrationLink({
      taskId: params.taskId,
      type: params.type,
    });

    if (existingLink) {
      // Update existing link
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

    // Create new link
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

export async function getIntegrationLink(params: GetIntegrationLinkParams) {
  try {
    const [link] = await db
      .select()
      .from(externalLinksTable)
      .where(
        and(
          eq(externalLinksTable.taskId, params.taskId),
          eq(externalLinksTable.type, params.type),
        ),
      )
      .limit(1);

    return link || null;
  } catch (error) {
    console.error(`Error getting ${params.type} link:`, error);
    return null;
  }
}

export async function deleteIntegrationLink(params: GetIntegrationLinkParams) {
  try {
    const [deletedLink] = await db
      .delete(externalLinksTable)
      .where(
        and(
          eq(externalLinksTable.taskId, params.taskId),
          eq(externalLinksTable.type, params.type),
        ),
      )
      .returning();

    return deletedLink || null;
  } catch (error) {
    console.error(`Error deleting ${params.type} link:`, error);
    return null;
  }
}
