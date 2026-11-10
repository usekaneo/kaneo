import { initializeQuillsWorkspace } from "./initialize-workspace";
import { eq, sql } from "drizzle-orm";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import {
  drizzle,
  NodePgTransaction,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { PgDialect } from "drizzle-orm/pg-core";
import { getDatabasePool } from "../index";
import * as schema from "./schema";

type Transaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];
declare const workspaceScope: unique symbol;
export type Database = Transaction & { readonly [workspaceScope]: true };

async function scopedTransaction<T>(
  work: (tx: Transaction) => Promise<T>,
  snapshot = false,
): Promise<T> {
  const client = await getDatabasePool().connect();
  let active = true;
  // Retained transactions and lazy query builders must never reuse a released client.
  const guarded = new Proxy(client, {
    get(target, property) {
      const value = Reflect.get(target, property);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        if (!active) throw new Error("Quills transaction has ended");
        return Reflect.apply(value, target, args);
      };
    },
  });
  try {
    return await drizzle(client).transaction(
      async () => {
        const db = drizzle(guarded, { schema });
        const tx = new NodePgTransaction<
          typeof schema,
          NonNullable<typeof db._.schema>
        >(new PgDialect(), db._.session, {
          fullSchema: db._.fullSchema,
          schema: db._.schema!,
          tableNamesMap: db._.tableNamesMap,
        });
        try {
          return await work(tx);
        } finally {
          // Finalization uses the private client; caller queries close before COMMIT.
          active = false;
        }
      },
      { isolationLevel: snapshot ? "repeatable read" : "read committed" },
    );
  } finally {
    active = false;
    client.release();
  }
}

export type QuillsActor = {
  principalId: typeof schema.principal.$inferSelect.id;
  userId: string;
  workspaceId: string;
};

export async function withQuillsWorkspace<T>(
  context: { workspaceId: string; userId: string },
  work: (db: Database, actor: QuillsActor) => Promise<T>,
  options: { exclusiveWorkspace?: boolean; snapshot?: boolean } = {},
): Promise<T> {
  if (!context.workspaceId || !context.userId)
    throw new Error("Workspace and user are required");
  return scopedTransaction(async (tx) => {
    const workspace = await tx.execute<{
      name: string;
      slug: string;
      userName: string;
      image: string | null;
      role: string | null;
    }>(sql`
      SELECT w.name, w.slug, u.name AS "userName", u.image, u.role
      FROM public.workspace w, public."user" u
      WHERE w.id = ${context.workspaceId} AND u.id = ${context.userId}
      AND w.archived_at IS NULL ${options.exclusiveWorkspace ? sql`FOR UPDATE OF w` : sql`FOR SHARE OF w, u`}
    `);
    if (workspace.rows.length !== 1)
      throw new Error("Quills workspace access denied");
    const membership = await tx.execute(sql`
      SELECT id FROM public.workspace_member
      WHERE workspace_id = ${context.workspaceId} AND user_id = ${context.userId} FOR SHARE
    `);
    const identity = workspace.rows[0]!;
    if (membership.rows.length !== 1 && !hasInstanceAdminRole(identity.role))
      throw new Error("Quills workspace access denied");
    await tx.execute(
      sql`select set_config('quills.workspace_id', ${context.workspaceId}, true)`,
    );
    await tx.execute(sql`SET LOCAL ROLE quills_runtime`);
    await initializeQuillsWorkspace(tx as Database, {
      workspaceId: context.workspaceId,
      name: identity.name,
      slug: identity.slug,
    });
    let actor = (
      await tx
        .select({ id: schema.principal.id })
        .from(schema.principal)
        .where(eq(schema.principal.kaneoUserId, context.userId))
    )[0];
    if (!actor) {
      await tx
        .insert(schema.principal)
        .values({
          kaneoUserId: context.userId,
          type: "user",
          role: "user",
          displayName: identity.userName,
          avatarUrl: identity.image,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
      actor = (
        await tx
          .select({ id: schema.principal.id })
          .from(schema.principal)
          .where(eq(schema.principal.kaneoUserId, context.userId))
      )[0];
    }
    if (!actor) throw new Error("Quills actor could not be initialized");
    return work(tx as Database, {
      principalId: actor.id,
      userId: context.userId,
      workspaceId: context.workspaceId,
    });
  }, options.snapshot);
}

/** Trusted maintenance entry point; request handlers must use withQuillsWorkspace. */
export async function withQuillsSystemWorkspace<T>(
  workspaceId: string,
  work: (db: Database) => Promise<T>,
  options: { allowArchived?: boolean; snapshot?: boolean } = {},
): Promise<T> {
  if (!workspaceId) throw new Error("Workspace is required");
  return scopedTransaction(async (tx) => {
    const result = await tx.execute<{ id: string; name: string; slug: string }>(
      sql`SELECT id, name, slug FROM public.workspace WHERE id = ${workspaceId} AND (${options.allowArchived === true} OR archived_at IS NULL) FOR SHARE`,
    );
    if (result.rows.length !== 1)
      throw new Error("Quills workspace is unavailable");
    await tx.execute(
      sql`select set_config('quills.workspace_id', ${workspaceId}, true)`,
    );
    await tx.execute(sql`SET LOCAL ROLE quills_runtime`);
    if (!options.allowArchived)
      await initializeQuillsWorkspace(tx as Database, {
        workspaceId,
        ...result.rows[0]!,
      });
    return work(tx as Database);
  }, options.snapshot);
}
