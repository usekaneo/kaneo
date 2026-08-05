import { and, eq, lt } from "drizzle-orm";
import db from "../database";
import { mcpOauthStateTable } from "../database/schema";

export type OauthStateKind = "client" | "code" | "request";

export async function putState(
  kind: OauthStateKind,
  key: string,
  payload: unknown,
  expiresAt: Date,
): Promise<void> {
  await db.insert(mcpOauthStateTable).values({ kind, key, payload, expiresAt });
}

export async function getState<T>(
  kind: OauthStateKind,
  key: string,
): Promise<T | null> {
  const [row] = await db
    .select()
    .from(mcpOauthStateTable)
    .where(
      and(eq(mcpOauthStateTable.kind, kind), eq(mcpOauthStateTable.key, key)),
    )
    .limit(1);

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row.payload as T;
}

// Single DELETE ... RETURNING keeps consumption single-use across replicas.
export async function consumeState<T>(
  kind: OauthStateKind,
  key: string,
): Promise<T | null> {
  const [row] = await db
    .delete(mcpOauthStateTable)
    .where(
      and(eq(mcpOauthStateTable.kind, kind), eq(mcpOauthStateTable.key, key)),
    )
    .returning();

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row.payload as T;
}

export async function deleteExpiredStates(): Promise<void> {
  await db
    .delete(mcpOauthStateTable)
    .where(lt(mcpOauthStateTable.expiresAt, new Date()));
}
