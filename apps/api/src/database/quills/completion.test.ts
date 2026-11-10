import { randomUUID } from "node:crypto";
import { tickets, ticketStatuses } from "./schema/tickets";
import {
  helpCenterArticles as kbArticles,
  helpCenterCategories as kbCategories,
} from "./schema/kb";
import { pageViews } from "./schema/visitor-analytics";
import { verifyPrivateObjectExists } from "../../storage/s3";
import { boundedArchiveQuery } from "../../quills/transfer/archive";
import { beforeAll, afterAll, describe, it, expect, vi } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq, sql } from "drizzle-orm";
import { resolve } from "node:path";
import { Hono } from "hono";
import * as kaneo from "../schema";
import { runQuillsMigrations } from "./migrate";
import { withQuillsWorkspace } from "./client";
import { boards } from "./schema/boards";
import { posts } from "./schema/posts";
import { postStatuses } from "./schema/statuses";
import { teams, teamMembers } from "./schema/teams";
import { boardProjects, postTasks } from "./schema/platform-links";
import { auditLog } from "./schema/audit-log";
import { events } from "./schema/events";
import { jobQueue } from "./schema/job-queue";
import { settings } from "./schema/auth";
import { recordQuillsChange } from "../../quills/events";
import {
  claimQuillsJob,
  enqueueQuillsEvent,
  finishQuillsJob,
} from "../../quills/jobs/queue";
import { drainQuillsWorkspace } from "../../quills/jobs/worker";
import { pruneQuillsWorkspace } from "../../quills/jobs/retention";
import { exportWorkspaceArchive } from "../../quills/transfer/archive";
import {
  importWorkspaceArchive,
  prepareArchive,
} from "../../quills/transfer/import-archive";
import router from "../../quills";
import type { BaseVariables } from "../../openapi";
let pool: Pool;
const database = () => drizzle(pool, { schema: kaneo });
vi.mock("../index", () => ({
  getDatabasePool: () => pool,
  get schema() {
    return kaneo;
  },
  default: new Proxy(
    {},
    {
      get(_target, key) {
        const db = database();
        const value = Reflect.get(db, key);
        return typeof value === "function" ? value.bind(db) : value;
      },
    },
  ),
}));
vi.mock("../../ws", () => ({ broadcastToUserAndWait: vi.fn(async () => {}) }));
vi.mock("../../storage/s3", () => ({
  verifyPrivateObjectExists: vi.fn(async () => {}),
  deleteS3Object: vi.fn(async () => {}),
}));
let importedNumber = 0;
let historicalPartition: string | undefined;
const url = process.env.QUILLS_TEST_DATABASE_URL;
const prefix = `complete_${Date.now().toString(36)}`;
const a = prefix + "_a",
  b = prefix + "_b",
  c = prefix + "_c",
  d = prefix + "_d",
  user = prefix + "_user",
  peer = prefix + "_peer";
const context = (workspaceId = a) => ({ workspaceId, userId: user });
const scoped = <T>(
  work: Parameters<typeof withQuillsWorkspace<T>>[1],
  workspaceId = a,
) => withQuillsWorkspace(context(workspaceId), work);
const app = new Hono<{ Variables: BaseVariables & { workspaceId: string } }>();
app.use("*", async (c, next) => {
  c.set("userId", user);
  c.set("user", null);
  await next();
});
app.route("/quills", router);
const request = (path: string, method = "GET", body?: unknown) =>
  app.request(`/quills/${a}/${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
let board: typeof boards.$inferSelect, post: typeof posts.$inferSelect;
const project = prefix + "_project",
  foreignProject = prefix + "_foreign",
  task = prefix + "_task",
  team = prefix + "_team";
describe.skipIf(!url)("Quills completion", () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
      !parsed.pathname.startsWith("/quills_")
    )
      throw new Error("Use a disposable local quills_ database");
    pool = new Pool({ connectionString: url, max: 6 });
    await migrate(drizzle(pool), { migrationsFolder: resolve("drizzle") });
    await runQuillsMigrations(url!, resolve("drizzle/quills"));
    for (const id of [user, peer])
      await database()
        .insert(kaneo.userTable)
        .values({ id, name: id, email: id + "@example.test" });
    for (const id of [a, b, c, d]) {
      await database()
        .insert(kaneo.workspaceTable)
        .values({ id, name: id, slug: id, createdAt: new Date() });
      await database().insert(kaneo.workspaceUserTable).values({
        workspaceId: id,
        userId: user,
        role: "owner",
        joinedAt: new Date(),
      });
    }
    await database().insert(kaneo.workspaceUserTable).values({
      workspaceId: a,
      userId: peer,
      role: "member",
      joinedAt: new Date(),
    });
    await database()
      .insert(kaneo.projectTable)
      .values([
        { id: project, name: "Local", slug: project, workspaceId: a },
        {
          id: foreignProject,
          name: "Other",
          slug: foreignProject,
          workspaceId: b,
        },
      ]);
    await database().insert(kaneo.taskTable).values({
      id: task,
      title: "Native task",
      projectId: project,
      number: 1,
    });
    await database().insert(kaneo.teamTable).values({
      id: team,
      name: "Native team",
      workspaceId: a,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await database()
      .insert(kaneo.teamMemberTable)
      .values({
        id: prefix + "_tm",
        teamId: team,
        userId: peer,
        createdAt: new Date(),
      });
    await scoped(async (tx, actor) => {
      board = (
        await tx
          .insert(boards)
          .values({ name: "Feedback", slug: "feedback" })
          .returning()
      )[0]!;
      const [status] = await tx.select().from(postStatuses).limit(1);
      post = (
        await tx
          .insert(posts)
          .values({
            title: "Idea",
            content: "Feature request",
            boardId: board.id,
            principalId: actor.principalId,
            statusId: status!.id,
          })
          .returning()
      )[0]!;
    });
  }, 120000);
  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM public.workspace WHERE id=ANY($1::text[])", [
      [a, b, c, d],
    ]);
    await pool.query('DELETE FROM public."user" WHERE id=ANY($1::text[])', [
      [user, peer],
    ]);
    if (historicalPartition)
      await pool.query(`DROP TABLE IF EXISTS quills.${historicalPartition}`);
    await pool.end();
  });
  it("serializes concurrent startup without concurrent-index deadlocks", async () => {
    await Promise.all([
      runQuillsMigrations(url!, resolve("drizzle/quills")),
      runQuillsMigrations(url!, resolve("drizzle/quills")),
    ]);
  }, 120000);
  it("recovers an operational index lost during an interrupted rebuild without changing the manifest", async () => {
    const before = await pool.query(
      "SELECT definition FROM quills_migrations.schema_manifest WHERE id=true",
    );
    // This is the persisted state after DROP INDEX succeeds and the process stops before CREATE.
    await pool.query("DROP INDEX quills.files_storage_key_lookup_idx");
    try {
      await runQuillsMigrations(url!, resolve("drizzle/quills"));
      const after = await pool.query(
        "SELECT definition,definition=quills_migrations.current_schema_manifest() AS matches FROM quills_migrations.schema_manifest WHERE id=true",
      );
      expect(after.rows[0].matches).toBe(true);
      expect(after.rows[0].definition).toEqual(before.rows[0].definition);
      expect(
        (
          await pool.query(
            "SELECT indisvalid FROM pg_index WHERE indexrelid='quills.files_storage_key_lookup_idx'::regclass",
          )
        ).rows[0].indisvalid,
      ).toBe(true);
    } finally {
      await pool.query(
        "CREATE INDEX IF NOT EXISTS files_storage_key_lookup_idx ON quills.files(storage_key) WHERE storage_key IS NOT NULL",
      );
    }
  }, 120000);
  it("rejects restored defaults, disabled shared triggers and wrong operational index definitions", async () => {
    const client = await pool.connect();
    const { verifyQuillsPostconditions } = await import("./schema-ops");
    try {
      for (const ddl of [
        "ALTER TABLE quills.settings ALTER COLUMN catalogue_version SET DEFAULT 77",
        "ALTER TABLE public.team DISABLE TRIGGER quills_shared_team_roster",
        "ALTER INDEX quills.kb_categories_position_idx RENAME TO quills_wrong_position_idx",
        "DROP INDEX quills.files_storage_key_lookup_idx; CREATE INDEX files_storage_key_lookup_idx ON quills.files(name)",
      ]) {
        await client.query("BEGIN");
        try {
          // The roster trigger belongs to team_member.
          await client.query(
            ddl.replace("public.team DISABLE", "public.team_member DISABLE"),
          );
          await expect(verifyQuillsPostconditions(client)).rejects.toThrow(
            /manifest|index definition/,
          );
        } finally {
          await client.query("ROLLBACK");
        }
      }
    } finally {
      client.release();
    }
  });
  it("initializes only once and keeps workspace custom status changes", async () => {
    await scoped(async (tx) => {
      expect((await tx.select().from(settings))[0]!.catalogueVersion).toBe(1);
      await tx.update(postStatuses).set({ name: "Custom status" });
    });
    expect(
      await scoped(
        async (tx) => (await tx.select().from(postStatuses))[0]!.name,
      ),
    ).toBe("Custom status");
  });
  it("links native resources, audits the canonical actor, and rejects foreign tenants", async () => {
    expect(
      (await request(`boards/${board.id}/projects/${project}`, "PUT")).status,
    ).toBe(200);
    expect(
      (await request(`posts/${post.id}/tasks/${task}`, "PUT")).status,
    ).toBe(200);
    expect(
      (await request(`boards/${board.id}/projects/${foreignProject}`, "PUT"))
        .status,
    ).toBe(404);
    expect(
      (await request(`boards/${board.id}/projects/${project}`, "PUT")).status,
    ).toBe(200);
    const data = await scoped(async (tx, actor) => ({
      audit: await tx.select().from(auditLog),
      events: await tx.select().from(events),
      actor,
    }));
    expect(data.audit).toHaveLength(2);
    expect(data.events).toHaveLength(2);
    expect(
      data.audit.every(
        (row) => row.actorPrincipalId === data.actor.principalId,
      ),
    ).toBe(true);
    await expect(scoped((tx) => tx.delete(auditLog))).rejects.toThrow();
    await expect(
      scoped((tx) => tx.update(auditLog).set({ eventType: "tampered" })),
    ).rejects.toThrow();
  });
  it("projects shared teams and prevents independent roster edits", async () => {
    const response = await request("teams", "POST", {
      kaneoTeamId: team,
      isDefault: true,
    });
    expect(response.status).toBe(200);
    const result = await scoped(async (tx) => ({
      teams: await tx.select().from(teams),
      members: await tx.select().from(teamMembers),
    }));
    expect(result.teams[0]!.name).toBe("Native team");
    expect(result.members).toHaveLength(1);
    await expect(scoped((tx) => tx.delete(teamMembers))).rejects.toThrow();
    await pool.query("UPDATE public.team SET name='Renamed team' WHERE id=$1", [
      team,
    ]);
    expect(
      await scoped(async (tx) => (await tx.select().from(teams))[0]!.name),
    ).toBe("Renamed team");
    await pool.query(
      "DELETE FROM public.workspace_member WHERE workspace_id=$1 AND user_id=$2",
      [a, peer],
    );
    expect(await scoped((tx) => tx.select().from(teamMembers))).toHaveLength(0);
    await database().insert(kaneo.workspaceUserTable).values({
      workspaceId: a,
      userId: peer,
      role: "member",
      joinedAt: new Date(),
    });
    expect(await scoped((tx) => tx.select().from(teamMembers))).toHaveLength(1);
  });
  it("delivers the durable outbox and retries failed delivery without acknowledging it", async () => {
    const failure = await drainQuillsWorkspace(a, async () => {
      throw new Error("provider unavailable");
    });
    expect(failure.failed).toBeGreaterThan(0);
    expect(
      await scoped(async (tx) =>
        (await tx.select().from(events)).every((e) => !e.publishedAt),
      ),
    ).toBe(true);
    await scoped((tx) => tx.update(jobQueue).set({ runAt: new Date(0) }));
    const deliver = vi.fn(async () => {});
    const success = await drainQuillsWorkspace(a, deliver);
    expect(success.failed).toBe(0);
    expect(deliver).toHaveBeenCalled();
    expect(
      await scoped(async (tx) =>
        (await tx.select().from(events)).every((e) => e.publishedAt),
      ),
    ).toBe(true);
    expect((await drainQuillsWorkspace(a, deliver)).processed).toBe(0);
  });
  it("fences expired workers and only lets one worker claim a pending job", async () => {
    await scoped((tx, actor) =>
      recordQuillsChange(tx, actor, {
        type: "team.bound",
        entityType: "team",
        entityId: "lease-test",
      }),
    );
    const claims = await Promise.all([
      scoped(claimQuillsJob),
      scoped(claimQuillsJob),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const old = claims.find(Boolean)!;
    await scoped((tx) =>
      tx
        .update(jobQueue)
        .set({ lockedUntil: new Date(0) })
        .where(eq(jobQueue.id, old.id)),
    );
    const replacement = (await scoped(claimQuillsJob))!;
    expect(replacement.leaseToken).not.toBe(old.leaseToken);
    await expect(
      scoped((tx) => finishQuillsJob(tx, old.id, old.leaseToken!)),
    ).rejects.toThrow("lease lost");
    await scoped((tx) =>
      finishQuillsJob(tx, replacement.id, replacement.leaseToken!, "failed"),
    );
    await scoped((tx) =>
      tx
        .update(jobQueue)
        .set({ runAt: new Date(0) })
        .where(eq(jobQueue.id, old.id)),
    );
    const last = (await scoped(claimQuillsJob))!;
    await scoped((tx) =>
      finishQuillsJob(tx, last.id, last.leaseToken!, "failed"),
    );
    expect((await request(`jobs/${old.jobId}/retry`, "POST")).status).toBe(200);
    expect((await drainQuillsWorkspace(a, async () => {})).processed).toBe(1);
  });
  it("keeps audit and pending work while pruning only eligible old records", async () => {
    await scoped(async (tx) => {
      await tx.update(events).set({ publishedAt: new Date(0) });
      await tx.update(jobQueue).set({ finishedAt: new Date(0) });
      await enqueueQuillsEvent(tx, "pending");
      await pruneQuillsWorkspace(tx, { events: 1, jobs: 1, logs: 1 });
    });
    expect(await scoped((tx) => tx.select().from(events))).toHaveLength(0);
    expect(await scoped((tx) => tx.select().from(jobQueue))).toHaveLength(1);
    expect(
      (await scoped((tx) => tx.select().from(auditLog))).length,
    ).toBeGreaterThan(0);
    await scoped((tx) => tx.delete(jobQueue));
  });
  it("bounds link pages and rejects oversized transport requests", async () => {
    const extra = await scoped(async (tx) => {
      const [row] = await tx
        .insert(boards)
        .values({ name: "Extra", slug: "extra" })
        .returning();
      await tx
        .insert(boardProjects)
        .values({ boardId: row!.id, projectId: project });
      return row!;
    });
    try {
      const first = await (await request("links?limit=1")).json();
      expect(first.nextOffset).toBe(1);
      expect(first.boards).toHaveLength(1);
      const second = await (await request("links?limit=1&offset=1")).json();
      expect(second.nextOffset).toBeNull();
      expect(second.boards).toHaveLength(1);
      expect(second.boards[0].boardId).not.toBe(first.boards[0].boardId);
      expect((await request("links?limit=65535")).status).toBe(400);
    } finally {
      await scoped((tx) => tx.delete(boards).where(eq(boards.id, extra.id)));
    }
  });
  it("rejects archive payloads in PostgreSQL before buffering their contents", async () => {
    const result = await scoped((tx) =>
      tx.execute<{ row: unknown }>(
        sql.raw(
          boundedArchiveQuery(
            "SELECT jsonb_build_object('text',repeat('x',1024)) AS row FROM generate_series(1,20)",
            512,
          ),
        ),
      ),
    );
    expect(result.rows).toHaveLength(20);
    expect(result.rows.every((row) => row.row === null)).toBe(true);
  });
  it("exports and imports a complete workspace, with a rollback-only dry run", async () => {
    importedNumber =
      Number(
        (await pool.query("SELECT last_value FROM quills.tickets_number_seq"))
          .rows[0].last_value,
      ) + 100;
    await scoped(async (tx) => {
      const [status] = await tx.select().from(ticketStatuses).limit(1);
      await tx.insert(tickets).values({
        title: "Imported ticket",
        number: importedNumber,
        statusId: status!.id,
      });
    });
    const archive = await withQuillsWorkspace(
      context(),
      (tx) => exportWorkspaceArchive(tx, a),
      { snapshot: true },
    );
    const categoryId = randomUUID(),
      articleId = randomUUID();
    archive.tables.kb_categories = [
      { id: categoryId, name: "Guides", slug: "guides", url_id: 810 },
    ];
    archive.tables.kb_articles = [
      {
        id: articleId,
        category_id: categoryId,
        title: "Intro",
        slug: "intro",
        url_id: 910,
        principal_id: archive.tables.principal!.find(
          (p) => p.kaneo_user_id === user,
        )!.id!,
        content: "See /hc/en/articles/910-intro",
      },
    ];
    let occurredAt = "";
    for (let age = 20; age < 90; age++) {
      const date = new Date(Date.now() - age * 86400000);
      const name =
        "page_views_" + date.toISOString().slice(0, 10).replaceAll("-", "");
      if (
        !(
          await pool.query("SELECT to_regclass($1) AS name", ["quills." + name])
        ).rows[0].name
      ) {
        historicalPartition = name;
        occurredAt = date.toISOString();
        break;
      }
    }
    expect(occurredAt).not.toBe("");
    archive.tables.page_views = [
      {
        id: randomUUID(),
        occurred_at: occurredAt,
        site_origin: "https://example.test",
        surface: "portal",
        path: "/fixture",
        visitor_hash: "fixture",
      },
    ];
    const storageKey = prefix + "/imported-file";
    archive.tables.files = [
      {
        id: randomUUID(),
        storage_key: storageKey,
        name: "Fixture",
        content_type: "text/plain",
        family: "text",
        size: 1,
        sha256: "fixture",
        source: "api",
      },
    ];
    vi.mocked(verifyPrivateObjectExists).mockImplementation(async (key) => {
      const lock = await pool.connect();
      try {
        await lock.query("BEGIN");
        const result = await lock.query(
          "SELECT pg_try_advisory_xact_lock(hashtext('storage-object'),hashtext($1)) AS acquired",
          [key],
        );
        expect(result.rows[0].acquired).toBe(false);
      } finally {
        await lock.query("ROLLBACK");
        lock.release();
      }
    });
    expect(archive.tables.events).toBeUndefined();
    expect(archive.tables.job_queue).toBeUndefined();
    const members = [
      { id: user, name: user, image: null },
      { id: peer, name: peer, image: null },
    ];
    for (const ws of [c, d])
      await database().insert(kaneo.workspaceUserTable).values({
        workspaceId: ws,
        userId: peer,
        role: "member",
        joinedAt: new Date(),
      });
    // Explicit mappings point to resources already created in the destination.
    for (const ws of [c, d]) {
      await database()
        .insert(kaneo.projectTable)
        .values({
          id: ws + "_project",
          name: "Target",
          slug: ws,
          workspaceId: ws,
        });
      await database()
        .insert(kaneo.taskTable)
        .values({
          id: ws + "_task",
          title: "Target",
          projectId: ws + "_project",
          number: 1,
        });
      await database()
        .insert(kaneo.teamTable)
        .values({
          id: ws + "_team",
          name: "Target team",
          workspaceId: ws,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }
    const prepared = (ws: string) =>
      prepareArchive(
        archive,
        {
          projects: { [project]: ws + "_project" },
          tasks: { [task]: ws + "_task" },
          teams: { [team]: ws + "_team" },
        },
        ws,
        members,
      );
    const sequenceBefore = (
      await pool.query(
        "SELECT last_value,is_called FROM quills.tickets_number_seq",
      )
    ).rows[0];
    await expect(
      withQuillsWorkspace(
        context(d),
        async (tx, actor) => {
          await importWorkspaceArchive(
            tx,
            actor,
            prepared(d),
            members,
            { name: d, slug: d },
            true,
          );
          const allocator = await pool.connect();
          try {
            await allocator.query("SET lock_timeout='100ms'");
            await expect(
              allocator.query("SELECT nextval('quills.tickets_number_seq')"),
            ).rejects.toMatchObject({ code: "55P03" });
          } finally {
            await allocator.query("RESET lock_timeout");
            allocator.release();
          }
          throw new Error("dry-run rollback");
        },
        { exclusiveWorkspace: true },
      ),
    ).rejects.toThrow("dry-run rollback");
    expect(await scoped((tx) => tx.select().from(boards), d)).toHaveLength(0);
    expect(
      (
        await pool.query(
          "SELECT last_value,is_called FROM quills.tickets_number_seq",
        )
      ).rows[0],
    ).toEqual(sequenceBefore);
    expect(
      (
        await pool.query("SELECT to_regclass($1) AS name", [
          "quills." + historicalPartition,
        ])
      ).rows[0].name,
    ).toBeNull();

    const imported = await withQuillsWorkspace(
      context(c),
      (tx, actor) =>
        importWorkspaceArchive(tx, actor, prepared(c), members, {
          name: c,
          slug: c,
        }),
      { exclusiveWorkspace: true },
    );
    expect(imported.rows).toBeGreaterThan(0);
    expect(await scoped((tx) => tx.select().from(boards), c)).toHaveLength(1);
    await scoped(async (tx, actor) => {
      expect((await tx.select().from(kbArticles))[0]).toMatchObject({
        urlId: 910,
        content: "See /hc/en/articles/910-intro",
      });
      expect((await tx.select().from(kbCategories))[0]!.urlId).toBe(810);
      expect(await tx.select().from(pageViews)).toHaveLength(1);
      const [status] = await tx.select().from(ticketStatuses).limit(1);
      const [next] = await tx
        .insert(tickets)
        .values({ title: "After import", statusId: status!.id })
        .returning();
      expect(next!.number).toBeGreaterThan(importedNumber);
      const [nextArticle] = await tx
        .insert(kbArticles)
        .values({
          title: "Next",
          slug: "next",
          content: "",
          categoryId: (await tx.select().from(kbCategories))[0]!.id,
          principalId: actor.principalId,
        })
        .returning();
      expect(nextArticle!.urlId).toBeGreaterThan(910);
      const [nextCategory] = await tx
        .insert(kbCategories)
        .values({ name: "Next", slug: "next" })
        .returning();
      expect(nextCategory!.urlId).toBeGreaterThan(810);
    }, c);

    await expect(
      withQuillsWorkspace(
        context(c),
        (tx, actor) =>
          importWorkspaceArchive(tx, actor, prepared(c), members, {
            name: c,
            slug: c,
          }),
        { exclusiveWorkspace: true },
      ),
    ).rejects.toThrow("must be empty");
  });
  it("removes old shared roster entries when a membership changes identity", async () => {
    const replacement = prefix + "_replacement";
    await database()
      .insert(kaneo.userTable)
      .values({
        id: replacement,
        name: "Replacement",
        email: replacement + "@example.test",
      });
    try {
      await pool.query(
        "UPDATE public.workspace_member SET user_id=$1 WHERE workspace_id=$2 AND user_id=$3",
        [replacement, a, peer],
      );
      expect(await scoped((tx) => tx.select().from(teamMembers))).toHaveLength(
        0,
      );
      await pool.query(
        "UPDATE public.workspace_member SET user_id=$1 WHERE workspace_id=$2 AND user_id=$3",
        [peer, a, replacement],
      );
      expect(await scoped((tx) => tx.select().from(teamMembers))).toHaveLength(
        1,
      );
    } finally {
      await pool.query('DELETE FROM public."user" WHERE id=$1', [replacement]);
    }
  });
  it("detaches moved native links without deleting feedback", async () => {
    await pool.query("UPDATE public.project SET workspace_id=$1 WHERE id=$2", [
      b,
      project,
    ]);
    expect(await scoped((tx) => tx.select().from(boardProjects))).toHaveLength(
      0,
    );
    expect(await scoped((tx) => tx.select().from(postTasks))).toHaveLength(0);
    expect(await scoped((tx) => tx.select().from(posts))).toHaveLength(1);
  });
});
