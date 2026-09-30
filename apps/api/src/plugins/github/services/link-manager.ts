import { randomUUID } from "node:crypto";
import {
  parseDeferredIssueEdit,
  type IssueField,
} from "../utils/deferred-issue-edit";
import { mergeSyncMetadata } from "../utils/merge-sync-metadata";
import { parseLinkMetadata } from "../utils/parse-link-metadata";
import {
  outboundStamp,
  uncertainOutboundIntents,
  type SyncStamp,
} from "../utils/sync-echo";
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
  deferredEdit?: {
    fields: IssueField[];
    repairFields?: IssueField[];
    scope: string;
  };
  completeDeferredEdit?: string;
  retireUncertainOutbound?: IssueField;
  retireOutboundIntents?: { field: IssueField; intentIds: string[] };
  outbound?: {
    field: "title" | "description" | "state";
    value: string;
    updatedAt?: string;
    intentId?: string;
    pending?: boolean;
    cancelled?: boolean;
    uncertain?: boolean;
  };
  observedOutbound?: {
    field: "title" | "description" | "state";
    intentId: string;
    updatedAt: string;
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
  if (
    params.outbound ||
    params.metadata ||
    params.observedOutbound ||
    params.deferredEdit ||
    params.completeDeferredEdit ||
    params.retireOutboundIntents ||
    params.retireUncertainOutbound
  ) {
    return database.transaction(async (tx) => {
      const link = await lockExternalLink(id, tx);
      if (!link) return false;
      const metadata = parseLinkMetadata<
        Record<string, unknown> & { lastSync?: Record<string, SyncStamp> }
      >(link.metadata, { externalLinkId: id, source: "sync_update" });
      const merged = mergeSyncMetadata(metadata, params.metadata ?? {});
      // Ordinary sync metadata cannot resurrect or clear a scheduler job.
      delete merged.deferredIssueEdit;
      if (metadata.deferredIssueEdit)
        merged.deferredIssueEdit = metadata.deferredIssueEdit;
      const previousJob = parseDeferredIssueEdit(metadata.deferredIssueEdit);
      if (params.completeDeferredEdit === previousJob?.id)
        delete merged.deferredIssueEdit;
      if (params.deferredEdit) {
        const { fields, repairFields = [], scope } = params.deferredEdit;
        // The last queued direction for each field supersedes its older intent.
        const repairs = [
          ...new Set([
            ...(previousJob?.scope === scope
              ? (previousJob.repairFields ?? []).filter(
                  (field) => !fields.includes(field),
                )
              : []),
            ...repairFields,
          ]),
        ];
        merged.deferredIssueEdit = {
          id: randomUUID(),
          scope,
          ...(repairs.length ? { repairFields: repairs } : {}),
          fields: [
            ...new Set([
              ...(previousJob?.scope === scope
                ? previousJob.fields.filter(
                    (field) => !repairFields.includes(field),
                  )
                : []),
              ...fields,
            ]),
          ],
        };
      }
      if (params.observedOutbound) {
        const { field, intentId, updatedAt } = params.observedOutbound;
        const stamp = merged.lastSync?.[field];
        if (stamp)
          stamp.outbound = stamp.outbound?.map((entry) =>
            entry.intentId === intentId
              ? {
                  ...entry,
                  observedUpdatedAt:
                    !entry.observedUpdatedAt ||
                    updatedAt > entry.observedUpdatedAt
                      ? updatedAt
                      : entry.observedUpdatedAt,
                }
              : entry,
          );
      }
      if (params.retireOutboundIntents) {
        const { field, intentIds } = params.retireOutboundIntents;
        const ids = new Set(intentIds);
        const stamp = merged.lastSync?.[field];
        if (stamp)
          stamp.outbound = stamp.outbound?.map((entry) =>
            entry.intentId && ids.has(entry.intentId)
              ? { ...entry, pending: false, uncertain: false, cancelled: true }
              : entry,
          );
      }
      if (params.retireUncertainOutbound) {
        const stamp = merged.lastSync?.[params.retireUncertainOutbound];
        const settled = new Set(uncertainOutboundIntents(stamp));
        if (stamp)
          stamp.outbound = stamp.outbound?.map((entry) =>
            settled.has(entry)
              ? { ...entry, pending: false, uncertain: false, cancelled: true }
              : entry,
          );
      }
      if (params.outbound) {
        const { field, value, updatedAt, ...intent } = params.outbound;
        merged.lastSync = {
          ...merged.lastSync,
          [field]: outboundStamp(
            merged.lastSync?.[field],
            value,
            updatedAt,
            intent,
          ),
        };
      }
      await tx
        .update(externalLinkTable)
        .set({
          ...(params.title !== undefined ? { title: params.title } : {}),
          ...(params.url !== undefined ? { url: params.url } : {}),
          metadata: JSON.stringify(merged),
        })
        .where(eq(externalLinkTable.id, id));
      return true;
    });
  }
  const updateData: Record<string, unknown> = {};

  if (params.title !== undefined) {
    updateData.title = params.title;
  }
  if (params.url !== undefined) {
    updateData.url = params.url;
  }

  if (Object.keys(updateData).length === 0) {
    return false;
  }

  const updated = await database
    .update(externalLinkTable)
    .set(updateData)
    .where(eq(externalLinkTable.id, id))
    .returning({ id: externalLinkTable.id });
  return updated.length > 0;
}

export async function createOrUpdateExternalLink(
  params: CreateExternalLinkParams,
  database: DbOrTx = db,
): Promise<{ id: string; created: boolean }> {
  const existing = await findExternalLink(
    params.integrationId,
    params.resourceType,
    params.externalId,
    database,
  );

  if (existing) {
    await updateExternalLink(
      existing.id,
      {
        title: params.title,
        url: params.url,
        metadata: params.metadata,
      },
      database,
    );
    return { id: existing.id, created: false };
  }

  const link = await createExternalLink(params, database);
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
