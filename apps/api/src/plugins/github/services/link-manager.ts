import { outboundStamp, type SyncStamp } from "../utils/sync-echo";
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import {
  externalLinkTable,
  integrationTable,
  taskTable,
} from "../../../database/schema";

import { externalLinkScope } from "./integration-task-scope";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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
  outbound?: {
    field: "title" | "description" | "state";
    value: string;
    updatedAt?: string;
  };
  title?: string | null;
  url?: string;
  metadata?: Record<string, unknown>;
};

export async function createExternalLink(
  params: CreateExternalLinkParams,
  database: DbOrTx = db,
): Promise<{ id: string }> {
  if (database === db) {
    return db.transaction((tx) => createExternalLink(params, tx));
  }
  const [task] = await database
    .select({ id: taskTable.id })
    .from(taskTable)
    .innerJoin(
      integrationTable,
      eq(integrationTable.projectId, taskTable.projectId),
    )
    .where(
      and(
        eq(taskTable.id, params.taskId),
        eq(integrationTable.id, params.integrationId),
      ),
    )
    .for("share", { of: taskTable });
  if (!task)
    throw new Error("Task no longer belongs to the integration project");

  const result = await database
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
  database: DbOrTx = db,
) {
  return database.query.externalLinkTable.findFirst({
    where: and(
      eq(externalLinkTable.integrationId, integrationId),
      eq(externalLinkTable.resourceType, resourceType),
      eq(externalLinkTable.externalId, externalId),
      externalLinkScope(),
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
      externalLinkScope(),
    ),
  });
}

export async function findExternalLinksByTask(taskId: string) {
  return db.query.externalLinkTable.findMany({
    where: and(eq(externalLinkTable.taskId, taskId), externalLinkScope()),
    with: {
      integration: true,
    },
  });
}

export async function updateExternalLink(
  id: string,
  params: UpdateExternalLinkParams,
  database: DbOrTx = db,
) {
  if (params.outbound) {
    await db.transaction(async (tx) => {
      const [link] = await tx
        .select({ metadata: externalLinkTable.metadata })
        .from(externalLinkTable)
        .where(eq(externalLinkTable.id, id))
        .for("update");
      if (!link) return;
      const metadata = (link.metadata ? JSON.parse(link.metadata) : {}) as {
        lastSync?: Record<string, SyncStamp>;
      };
      const { field, value, updatedAt } = params.outbound!;
      await tx
        .update(externalLinkTable)
        .set({
          ...(params.title !== undefined ? { title: params.title } : {}),
          ...(params.url !== undefined ? { url: params.url } : {}),
          metadata: JSON.stringify({
            ...metadata,
            ...params.metadata,
            lastSync: {
              ...metadata.lastSync,
              [field]: outboundStamp(
                metadata.lastSync?.[field],
                value,
                updatedAt,
              ),
            },
          }),
        })
        .where(eq(externalLinkTable.id, id));
    });
    return;
  }
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

  await database
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

export async function lockExternalLink(id: string, database: DbOrTx) {
  const [link] = await database
    .select({ id: externalLinkTable.id, metadata: externalLinkTable.metadata })
    .from(externalLinkTable)
    .where(eq(externalLinkTable.id, id))
    .for("update");
  return link;
}
