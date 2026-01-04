import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";

export type CreateExternalLinkParams = {
  taskId: string;
  integrationId: string;
  resourceType: "issue" | "pull_request" | "branch";
  externalId: string;
  url: string;
  title?: string | null;
  metadata?: Record<string, unknown>;
};

export type UpdateExternalLinkParams = {
  title?: string | null;
  url?: string;
  metadata?: Record<string, unknown>;
};

export async function createExternalLink(
  params: CreateExternalLinkParams,
): Promise<{ id: string }> {
  const result = await db
    .insert(externalLinkTable)
    .values({
      taskId: params.taskId,
      integrationId: params.integrationId,
      resourceType: params.resourceType,
      externalId: params.externalId,
      url: params.url,
      title: params.title ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    })
    .returning({ id: externalLinkTable.id });

  const link = result[0];
  if (!link) {
    throw new Error("Failed to create external link");
  }

  return link;
}

export async function findExternalLink(
  integrationId: string,
  resourceType: string,
  externalId: string,
) {
  return db.query.externalLinkTable.findFirst({
    where: and(
      eq(externalLinkTable.integrationId, integrationId),
      eq(externalLinkTable.resourceType, resourceType),
      eq(externalLinkTable.externalId, externalId),
    ),
  });
}

export async function findExternalLinkByTaskAndType(
  taskId: string,
  integrationId: string,
  resourceType: string,
) {
  return db.query.externalLinkTable.findFirst({
    where: and(
      eq(externalLinkTable.taskId, taskId),
      eq(externalLinkTable.integrationId, integrationId),
      eq(externalLinkTable.resourceType, resourceType),
    ),
  });
}

export async function findExternalLinksByTask(taskId: string) {
  return db.query.externalLinkTable.findMany({
    where: eq(externalLinkTable.taskId, taskId),
    with: {
      integration: true,
    },
  });
}

export async function updateExternalLink(
  id: string,
  params: UpdateExternalLinkParams,
) {
  const updateData: Record<string, unknown> = {};

  if (params.title !== undefined) {
    updateData.title = params.title;
  }
  if (params.url !== undefined) {
    updateData.url = params.url;
  }
  if (params.metadata !== undefined) {
    updateData.metadata = JSON.stringify(params.metadata);
  }

  if (Object.keys(updateData).length === 0) {
    return;
  }

  await db
    .update(externalLinkTable)
    .set(updateData)
    .where(eq(externalLinkTable.id, id));
}

export async function createOrUpdateExternalLink(
  params: CreateExternalLinkParams,
): Promise<{ id: string; created: boolean }> {
  const existing = await findExternalLink(
    params.integrationId,
    params.resourceType,
    params.externalId,
  );

  if (existing) {
    await updateExternalLink(existing.id, {
      title: params.title,
      url: params.url,
      metadata: params.metadata,
    });
    return { id: existing.id, created: false };
  }

  const link = await createExternalLink(params);
  return { id: link.id, created: true };
}

export async function deleteExternalLink(id: string) {
  await db.delete(externalLinkTable).where(eq(externalLinkTable.id, id));
}

export async function getExternalLinksByIntegration(integrationId: string) {
  return db.query.externalLinkTable.findMany({
    where: eq(externalLinkTable.integrationId, integrationId),
  });
}
