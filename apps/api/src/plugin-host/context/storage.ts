import type { PluginStorage, StorageEntry } from "@kaneo/plugin-sdk/server";
import { and, asc, eq, like, sql } from "drizzle-orm";
import db from "../../database";
import { pluginStorageTable } from "../../database/schema";
import { escapeLikePattern } from "../../search/like-pattern";

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 1000;
const MAX_KEY_LENGTH = 512;

const valueText = sql<string>`${pluginStorageTable.value}::text`;

function assertKey(key: unknown): asserts key is string {
  if (typeof key !== "string" || key.length === 0) {
    throw new TypeError("Storage keys must be non-empty strings");
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new TypeError(
      `Storage keys must be at most ${MAX_KEY_LENGTH} characters`,
    );
  }
}

function toJson(value: unknown): string {
  const json = value === undefined ? undefined : JSON.stringify(value);
  if (json === undefined) {
    throw new TypeError(
      "Storage values must be JSON serializable. Use delete() to remove a key.",
    );
  }
  return json;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIST_LIMIT);
}

export function createPluginStorage(
  pluginId: string,
  workspaceId: string,
): PluginStorage {
  const scope = and(
    eq(pluginStorageTable.pluginId, pluginId),
    eq(pluginStorageTable.workspaceId, workspaceId),
  );

  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      assertKey(key);
      const [row] = await db
        .select({ value: valueText })
        .from(pluginStorageTable)
        .where(and(scope, eq(pluginStorageTable.key, key)))
        .limit(1);
      return row ? (JSON.parse(row.value) as T) : undefined;
    },

    async set(key, value) {
      assertKey(key);
      const json = sql`${toJson(value)}::jsonb`;
      await db
        .insert(pluginStorageTable)
        .values({ pluginId, workspaceId, key, value: json })
        .onConflictDoUpdate({
          target: [
            pluginStorageTable.pluginId,
            pluginStorageTable.workspaceId,
            pluginStorageTable.key,
          ],
          set: { value: json, updatedAt: new Date() },
        });
    },

    async delete(key) {
      assertKey(key);
      await db
        .delete(pluginStorageTable)
        .where(and(scope, eq(pluginStorageTable.key, key)));
    },

    async list<T = unknown>(
      options: { prefix?: string; limit?: number } = {},
    ): Promise<StorageEntry<T>[]> {
      const rows = await db
        .select({
          key: pluginStorageTable.key,
          value: valueText,
          updatedAt: pluginStorageTable.updatedAt,
        })
        .from(pluginStorageTable)
        .where(
          options.prefix
            ? and(
                scope,
                like(
                  pluginStorageTable.key,
                  `${escapeLikePattern(options.prefix)}%`,
                ),
              )
            : scope,
        )
        .orderBy(asc(pluginStorageTable.key))
        .limit(clampLimit(options.limit));
      return rows.map((row) => ({
        key: row.key,
        value: JSON.parse(row.value) as T,
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
  };
}
