import { beforeAll, afterAll, describe, expect, it, vi } from "vite-plus/test";
import { Client, Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql, eq } from "drizzle-orm";
import { resolve } from "node:path";
import { runQuillsMigrations } from "./migrate";
import { maintainPageViewPartitions } from "./page-view-partitions";
import { getMigrationStatus } from "./migration-status";
import { principal } from "./schema/auth";
import { boards } from "./schema/boards";
import { posts } from "./schema/posts";
import { postStatuses } from "./schema/statuses";
import { withQuillsWorkspace, type Database } from "./client";
import { conversationMessages, conversations } from "./schema/conversation";
import { seedSystemData } from "./seed-system";
import { settleExternalSideEffects } from "./settle-external-side-effects";
let pool: Pool;
vi.mock("../index", () => ({ getDatabasePool: () => pool }));
const url = process.env.QUILLS_TEST_DATABASE_URL;
const suffix = Date.now().toString(36);
const a = `quills_test_a_${suffix}`,
  b = `quills_test_b_${suffix}`;
const alice = `quills_test_alice_${suffix}`,
  bob = `quills_test_bob_${suffix}`;
const folder = resolve("drizzle/quills");
let principalA: typeof principal.$inferSelect;
let boardA: typeof boards.$inferSelect, boardB: typeof boards.$inferSelect;

describe.skipIf(!url)("Quills database isolation", () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
      !parsed.pathname.startsWith("/quills_")
    )
      throw new Error("Use a disposable local quills_ database");
    pool = new Pool({ connectionString: url, max: 3 });
    await migrate(drizzle(pool), { migrationsFolder: resolve("drizzle") });
    for (const id of [alice, bob])
      await pool.query(
        'INSERT INTO public."user" (id,name,email) VALUES ($1,$1,$2)',
        [id, `${id}@example.test`],
      );
    for (const [id, user] of [
      [a, alice],
      [b, bob],
    ]) {
      await pool.query(
        "INSERT INTO public.workspace (id,name,slug,created_at) VALUES ($1,$1,$1,now())",
        [id],
      );
      await pool.query(
        "INSERT INTO public.workspace_member (id,workspace_id,user_id,role,joined_at) VALUES ($1,$2,$3,'admin',now())",
        [`m_${id}`, id, user],
      );
    }
    await runQuillsMigrations(url!, folder);
  }, 120000);
  afterAll(async () => {
    if (!pool) return;
    await pool.query(
      "DELETE FROM public.workspace WHERE id = ANY($1::text[])",
      [[a, b]],
    );
    await pool.query('DELETE FROM public."user" WHERE id = ANY($1::text[])', [
      [alice, bob],
    ]);
    await pool.end();
  });
  it("allows equal slugs but scopes unfiltered reads and relational queries", async () => {
    boardA = await withQuillsWorkspace(
      { workspaceId: a, userId: alice },
      async (db) =>
        (
          await db
            .insert(boards)
            .values({ name: "A", slug: "same" })
            .returning()
        )[0]!,
    );
    boardB = await withQuillsWorkspace(
      { workspaceId: b, userId: bob },
      async (db) =>
        (
          await db
            .insert(boards)
            .values({ name: "B", slug: "same" })
            .returning()
        )[0]!,
    );
    principalA = await withQuillsWorkspace(
      { workspaceId: a, userId: alice },
      async (db) =>
        (
          await db
            .insert(principal)
            .values({
              displayName: "Actor",
              type: "service",
              createdAt: new Date(),
            })
            .returning()
        )[0]!,
    );
    const rows = await withQuillsWorkspace(
      { workspaceId: a, userId: alice },
      (db) => db.select().from(boards),
    );
    expect(rows.map((row) => row.name)).toEqual(["A"]);
    expect(
      await withQuillsWorkspace({ workspaceId: a, userId: alice }, (db) =>
        db.query.boards.findMany(),
      ),
    ).toHaveLength(1);
  });
  it("rejects nonmembers and explicit writes to another workspace", async () => {
    await expect(
      withQuillsWorkspace({ workspaceId: b, userId: alice }, (db) =>
        db.select().from(boards),
      ),
    ).rejects.toThrow("access denied");
    await expect(
      withQuillsWorkspace({ workspaceId: a, userId: alice }, (db) =>
        db.insert(boards).values({ workspaceId: b, name: "bad", slug: "bad" }),
      ),
    ).rejects.toThrow();
  });
  it("rejects cross-workspace foreign keys even with a valid target ID", async () => {
    const status = await withQuillsWorkspace(
      { workspaceId: a, userId: alice },
      async (db) => (await db.select().from(postStatuses))[0]!,
    );
    await withQuillsWorkspace({ workspaceId: a, userId: alice }, (db) =>
      db.insert(posts).values({
        boardId: boardA.id,
        title: "good",
        content: "Test",
        principalId: principalA.id,
        statusId: status.id,
      }),
    );
    await expect(
      withQuillsWorkspace({ workspaceId: a, userId: alice }, (db) =>
        db.insert(posts).values({
          boardId: boardB.id,
          title: "bad",
          content: "Test",
          principalId: principalA.id,
          statusId: status.id,
        }),
      ),
    ).rejects.toThrow();
  });
  it("scopes updates and clears context on pool reuse and rollback", async () => {
    await withQuillsWorkspace({ workspaceId: a, userId: alice }, async (db) => {
      await db
        .update(boards)
        .set({ name: "changed" })
        .where(eq(boards.id, boardB.id));
    });
    expect(
      (
        await withQuillsWorkspace({ workspaceId: b, userId: bob }, (db) =>
          db.select().from(boards),
        )
      )[0]?.name,
    ).toBe("B");
    await expect(
      withQuillsWorkspace({ workspaceId: a, userId: alice }, async () => {
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SET LOCAL ROLE quills_runtime");
      expect(
        (await connection.query("SELECT * FROM quills.boards")).rowCount,
      ).toBe(0);
    } finally {
      await connection.query("ROLLBACK");
      connection.release();
    }
  });
  it("rejects escaped transactions and lazy queries after commit or rollback", async () => {
    for (const rollback of [false, true]) {
      let escaped!: Database;
      let lazy!: PromiseLike<unknown>;
      const run = withQuillsWorkspace(
        { workspaceId: a, userId: alice },
        async (db) => {
          escaped = db;
          lazy = db.select().from(boards);
          if (rollback) throw new Error("test rollback");
        },
      );
      if (rollback) await expect(run).rejects.toThrow("test rollback");
      else await run;
      await expect(escaped.select().from(boards)).rejects.toThrow();
      await expect(lazy).rejects.toThrow();
      expect(
        await withQuillsWorkspace({ workspaceId: b, userId: bob }, (db) =>
          db.select().from(boards),
        ),
      ).toHaveLength(1);
    }
  });
  it("rejects detached work submitted while the transaction is committing", async () => {
    let detached!: Promise<boolean>;
    await withQuillsWorkspace({ workspaceId: a, userId: alice }, async (db) => {
      detached = new Promise((resolve) => {
        setImmediate(() => {
          Promise.resolve(db.execute(sql`select current_user`)).then(
            () => resolve(false),
            () => resolve(true),
          );
        });
      });
    });
    expect(await detached).toBe(true);
  });
  it("deduplicates provider messages within each workspace", async () => {
    for (const key of ["emailMessageId", "githubCommentId"] as const) {
      for (const [workspaceId, userId] of [
        [a, alice],
        [b, bob],
      ]) {
        const parent = await withQuillsWorkspace(
          { workspaceId: workspaceId!, userId: userId! },
          async (db) =>
            (
              await db
                .insert(conversations)
                .values({
                  visitorPrincipalId: (
                    await db
                      .insert(principal)
                      .values({ type: "service", createdAt: new Date() })
                      .returning()
                  )[0]!.id,
                  channel: "email",
                })
                .returning()
            )[0]!,
        );
        const values = {
          conversationId: parent.id,
          senderType: "system" as const,
          content: "Dedupe check",
          metadata: { [key]: "shared-provider-key" },
        };
        await withQuillsWorkspace(
          { workspaceId: workspaceId!, userId: userId! },
          (db) => db.insert(conversationMessages).values(values),
        );
        await expect(
          withQuillsWorkspace(
            { workspaceId: workspaceId!, userId: userId! },
            (db) => db.insert(conversationMessages).values(values),
          ),
        ).rejects.toThrow();
      }
    }
  });
  it("keeps seeds and restore settlement idempotent and workspace-scoped", async () => {
    await withQuillsWorkspace({ workspaceId: a, userId: alice }, (db) =>
      seedSystemData(db),
    );
    const result = await withQuillsWorkspace(
      { workspaceId: a, userId: alice },
      (db) =>
        settleExternalSideEffects(db, {
          restoredTo: new Date("2026-01-01T00:00:00Z"),
        }),
    );
    expect(result.steps.length).toBeGreaterThan(0);
    expect(
      await withQuillsWorkspace(
        { workspaceId: b, userId: bob },
        async (db) =>
          (
            await db.execute(
              sql`SELECT * FROM quills.audit_log WHERE event_type='restore.side_effects_settled'`,
            )
          ).rows,
      ),
    ).toHaveLength(0);
  });

  it("preserves workspace ownership when a nullable reference is deleted", async () => {
    await withQuillsWorkspace({ workspaceId: a, userId: alice }, async (db) => {
      const owner = (
        await db
          .insert(principal)
          .values({ type: "service", createdAt: new Date() })
          .returning()
      )[0]!;
      const post = (
        await db
          .insert(posts)
          .values({
            boardId: boardA.id,
            principalId: principalA.id,
            ownerPrincipalId: owner.id,
            title: "Nullable",
            content: "test",
          })
          .returning()
      )[0]!;
      await db.delete(principal).where(eq(principal.id, owner.id));
      const found = (
        await db.select().from(posts).where(eq(posts.id, post.id))
      )[0]!;
      expect(found.ownerPrincipalId).toBeNull();
      expect(found.workspaceId).toBe(a);
    });
  });
  it("rejects direct partition access and archived workspace access", async () => {
    await expect(
      withQuillsWorkspace({ workspaceId: a, userId: alice }, async (db) => {
        const partitions = await db.execute<{ relname: string }>(
          sql`SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhrelid WHERE i.inhparent='quills.page_views'::regclass LIMIT 1`,
        );
        await db.execute(
          sql`SELECT * FROM ${sql.identifier("quills")}.${sql.identifier(partitions.rows[0]!.relname)}`,
        );
      }),
    ).rejects.toThrow();
    await pool.query(
      "UPDATE public.workspace SET archived_at=now() WHERE id=$1",
      [b],
    );
    try {
      await expect(
        withQuillsWorkspace({ workspaceId: b, userId: bob }, (db) =>
          db.select().from(boards),
        ),
      ).rejects.toThrow("access denied");
    } finally {
      await pool.query(
        "UPDATE public.workspace SET archived_at=NULL WHERE id=$1",
        [b],
      );
    }
  });
  it("fails readiness when row security is missing", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "ALTER TABLE quills.boards DISABLE ROW LEVEL SECURITY",
      );
      const { verifyQuillsPostconditions } = await import("./schema-ops");
      await expect(verifyQuillsPostconditions(client)).rejects.toThrow(
        "migration manifest",
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
  it("maintains the partition window and retention under the migration lock", async () => {
    const lock = new Client({ connectionString: url });
    await lock.connect();
    try {
      await lock.query(
        "CREATE TABLE quills.page_views_19900101 PARTITION OF quills.page_views FOR VALUES FROM ('1990-01-01') TO ('1990-01-02')",
      );
      await lock.query(
        "SELECT pg_advisory_lock(48203, hashtext(current_database()))",
      );
      await maintainPageViewPartitions(url!);
      expect(
        (
          await lock.query(
            "SELECT to_regclass('quills.page_views_19900101') AS name",
          )
        ).rows[0].name,
      ).not.toBeNull();
      await lock.query(
        "SELECT pg_advisory_unlock(48203, hashtext(current_database()))",
      );
      await maintainPageViewPartitions(url!);
      expect(
        (
          await lock.query(
            "SELECT to_regclass('quills.page_views_19900101') AS name",
          )
        ).rows[0].name,
      ).toBeNull();
      expect(
        (
          await lock.query(
            "SELECT to_regclass('quills.page_views_' || to_char((now() AT TIME ZONE 'UTC')::date + 7, 'YYYYMMDD')) AS name",
          )
        ).rows[0].name,
      ).not.toBeNull();
    } finally {
      await lock.end();
    }
  });
  it("provisions Quills separately from the restricted application pool", async () => {
    const role = `quills_runtime_test_${suffix}`;
    const admin = pool;
    await admin.query(
      `CREATE ROLE "${role}" LOGIN NOINHERIT NOSUPERUSER NOCREATEROLE PASSWORD 'quills-test-only'`,
    );
    let restricted: Pool | undefined;
    try {
      await admin.query(
        `GRANT SELECT, UPDATE (id) ON public.workspace, public.workspace_member, public."user" TO "${role}"`,
      );
      await runQuillsMigrations(url!, folder, role);
      const restrictedUrl = new URL(url!);
      restrictedUrl.username = role;
      restrictedUrl.password = "quills-test-only";
      restricted = new Pool({ connectionString: restrictedUrl.href });
      await expect(
        restricted.query("CREATE TABLE quills.forbidden (id int)"),
      ).rejects.toThrow();
      await expect(
        restricted.query("SELECT * FROM quills.boards LIMIT 1"),
      ).rejects.toThrow();
      await expect(
        restricted.query("SELECT * FROM quills.storage_references() LIMIT 1"),
      ).resolves.toMatchObject({ command: "SELECT" });
      pool = restricted;
      const current = await withQuillsWorkspace(
        { workspaceId: a, userId: alice },
        async (db) => {
          await db.select().from(boards);
          return (
            await db.execute<{ current_user: string }>(sql`SELECT current_user`)
          ).rows[0];
        },
      );
      expect(current?.current_user).toBe("quills_runtime");
    } finally {
      pool = admin;
      await restricted?.end();
      await admin.query(`DROP OWNED BY "${role}"`);
      await admin.query(`DROP ROLE "${role}"`);
    }
  }, 120000);
  it("serializes concurrent migrators", async () => {
    await Promise.all([
      runQuillsMigrations(url!, folder),
      runQuillsMigrations(url!, folder),
    ]);
  }, 120000);
  it("reruns migrations without changing either ledger", async () => {
    const before = await pool.query(
      "SELECT * FROM drizzle.__drizzle_migrations ORDER BY id",
    );
    await runQuillsMigrations(url!, folder);
    expect(
      (
        await pool.query(
          "SELECT * FROM drizzle.__drizzle_migrations ORDER BY id",
        )
      ).rows,
    ).toEqual(before.rows);
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      expect((await getMigrationStatus(client, folder)).upToDate).toBe(true);
    } finally {
      await client.end();
    }
  }, 120000);
  it("initializes a workspace created after migrations on first access", async () => {
    const id = `quills_test_new_${suffix}`;
    await pool.query(
      "INSERT INTO public.workspace (id,name,slug,created_at) VALUES ($1,$1,$1,now())",
      [id],
    );
    await pool.query(
      "INSERT INTO public.workspace_member (id,workspace_id,user_id,role,joined_at) VALUES ($1,$2,$3,'admin',now())",
      [`m_${id}`, id, alice],
    );
    try {
      const results = await Promise.all(
        [1, 2].map(() =>
          withQuillsWorkspace({ workspaceId: id, userId: alice }, (db) =>
            db.select().from(postStatuses),
          ),
        ),
      );
      expect(results[0]!.length).toBeGreaterThan(0);
      expect(results[0]!.length).toBe(results[1]!.length);
    } finally {
      await pool.query("DELETE FROM public.workspace WHERE id=$1", [id]);
    }
  });
});
