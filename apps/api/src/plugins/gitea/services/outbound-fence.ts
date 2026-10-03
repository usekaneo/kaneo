import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import db from "../../../database";
import {
  externalLinkTable,
  integrationTable,
  taskTable,
} from "../../../database/schema";
import {
  canSyncGiteaIssues,
  giteaConfigSchema,
  normalizeGiteaBaseUrl,
  type GiteaConfig,
} from "../config";
import type { SyncStamp } from "../../github/utils/sync-echo";

export type GiteaOutboundBinding = {
  integrationId: string;
  projectId: string;
  config: GiteaConfig;
  taskId?: string;
  link?: { id: string; taskId: string; externalId?: string };
  intent?: { field: "title" | "description" | "state"; intentId: string };
};

export type GiteaWriteResult<T> = { sent: false } | { sent: true; value: T };

function sameConfig(saved: string, expected: GiteaConfig): boolean {
  try {
    const parsed = v.parse(giteaConfigSchema, JSON.parse(saved));
    const wanted = v.parse(giteaConfigSchema, expected);
    return (
      canSyncGiteaIssues(parsed) &&
      isDeepStrictEqual(
        {
          ...parsed,
          baseUrl: normalizeGiteaBaseUrl(parsed.baseUrl),
          issueSyncMode: parsed.issueSyncMode ?? "sync",
        },
        {
          ...wanted,
          baseUrl: normalizeGiteaBaseUrl(wanted.baseUrl),
          issueSyncMode: wanted.issueSyncMode ?? "sync",
        },
      )
    );
  } catch {
    return false;
  }
}

/** Serialize one bounded provider mutation with settings saves. The callback must
 * not acquire a database connection, lock task/link rows, or compose requests.
 * Completion metadata is recorded after this transaction releases its lock.
 */
export async function withGiteaOutboundWrite<T>(
  binding: GiteaOutboundBinding,
  write: () => Promise<T>,
): Promise<GiteaWriteResult<T>> {
  return db.transaction(async (tx): Promise<GiteaWriteResult<T>> => {
    const [integration] = await tx
      .select()
      .from(integrationTable)
      .where(eq(integrationTable.id, binding.integrationId))
      .for("share");
    if (
      !integration ||
      integration.isActive !== true ||
      integration.type !== "gitea" ||
      integration.projectId !== binding.projectId ||
      !sameConfig(integration.config, binding.config)
    )
      return { sent: false };

    const taskId = binding.link?.taskId ?? binding.taskId;
    if (taskId) {
      const [task] = await tx
        .select({ id: taskTable.id })
        .from(taskTable)
        .where(
          and(
            eq(taskTable.id, taskId),
            eq(taskTable.projectId, binding.projectId),
          ),
        );
      if (!task) return { sent: false };
    }
    if (binding.intent && !binding.link) return { sent: false };
    if (binding.link) {
      // Nonlocking reads deliberately allow task edits and inbound deliveries
      // while HTTP is in flight. Mode retirement first takes the integration lock.
      const [link] = await tx
        .select()
        .from(externalLinkTable)
        .where(
          and(
            eq(externalLinkTable.id, binding.link.id),
            eq(externalLinkTable.integrationId, binding.integrationId),
            eq(externalLinkTable.taskId, binding.link.taskId),
            eq(externalLinkTable.resourceType, "issue"),
          ),
        );
      if (
        !link ||
        (binding.link.externalId !== undefined &&
          link.externalId !== binding.link.externalId)
      )
        return { sent: false };
      if (binding.intent) {
        try {
          const metadata = JSON.parse(link.metadata ?? "{}") as {
            lastSync?: Partial<
              Record<"title" | "description" | "state", SyncStamp>
            >;
          };
          const intent = metadata.lastSync?.[
            binding.intent.field
          ]?.outbound?.find(
            (entry) => entry.intentId === binding.intent!.intentId,
          );
          if (!intent || intent.cancelled || !intent.pending)
            return { sent: false };
        } catch {
          return { sent: false };
        }
      }
    }
    return { sent: true, value: await write() };
  });
}
