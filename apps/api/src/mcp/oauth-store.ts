import { and, count, desc, eq, lt, notInArray } from "drizzle-orm";
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

// Evicts oldest-expiring rows so an insert after this call stays within maxRows.
export async function enforceStateCap(
  kind: OauthStateKind,
  maxRows: number,
): Promise<void> {
  const [countRow] = await db
    .select({ pending: count() })
    .from(mcpOauthStateTable)
    .where(eq(mcpOauthStateTable.kind, kind));

  if ((countRow?.pending ?? 0) < maxRows) return;

  const newest = db
    .select({ key: mcpOauthStateTable.key })
    .from(mcpOauthStateTable)
    .where(eq(mcpOauthStateTable.kind, kind))
    .orderBy(desc(mcpOauthStateTable.expiresAt))
    .limit(maxRows - 1);

  await db
    .delete(mcpOauthStateTable)
    .where(
      and(
        eq(mcpOauthStateTable.kind, kind),
        notInArray(mcpOauthStateTable.key, newest),
      ),
    );
}
