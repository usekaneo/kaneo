import { beforeAll, afterAll, describe, expect, it, vi } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { defaultRolePayloads } from "@kaneo/permissions";
import { seedSystemData } from "./seed-system";
import { Hono } from "hono";
import type { BaseVariables } from "../../openapi";
import * as kaneo from "../schema";
import { runQuillsMigrations } from "./migrate";
import { withQuillsWorkspace } from "./client";
import { principal, settings } from "./schema/auth";
import { files } from "./schema/files";
import { exportRuns } from "./schema/export-runs";
import { boards } from "./schema/boards";
import quillsRouter from "../../quills";
import { withQuillsRequest } from "../../quills/with-quills-request";
import { listWorkspaceObjectKeys } from "../../workspace/lifecycle/list-workspace-object-keys";
import { retryStorageCleanup } from "../../storage/cleanup-queue";
import { deleteS3Object } from "../../storage/s3";
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
      get(_target, property) {
        const db = database();
        const value = Reflect.get(db, property);
        return typeof value === "function" ? value.bind(db) : value;
      },
    },
  ),
}));
vi.mock("../../storage/s3", () => ({ deleteS3Object: vi.fn(async () => {}) }));
const url = process.env.QUILLS_TEST_DATABASE_URL;
const suffix = `platform_${Date.now().toString(36)}`;
const a = `${suffix}_a`,
  b = `${suffix}_b`,
  alice = `${suffix}_alice`,
  bob = `${suffix}_bob`;
const app = new Hono<{ Variables: BaseVariables & { workspaceId: string } }>();
app.use("*", async (c, next) => {
  c.set("userId", c.req.header("x-test-user") ?? "");
  c.set("user", null);
  if (c.req.header("x-test-key"))
    c.set("apiKey", {
      id: c.req.header("x-test-key")!,
      userId: c.get("userId"),
      enabled: true,
      permissions: { workspace: ["read"], quills: ["read"] },
    });
  await next();
});
app.route("/quills", quillsRouter);
app.post("/write/:workspaceId", async (c) => {
  c.set("workspaceId", c.req.param("workspaceId"));
  return c.json(
    await withQuillsRequest(
      c,
      { action: "create", projectId: c.req.query("projectId") },
      (db) =>
        db
          .insert(boards)
          .values({ name: "Created", slug: `created-${Date.now()}` })
          .returning(),
    ),
  );
});
const request = (path: string, userId = alice, method = "GET", key?: string) =>
  app.request(path, {
    method,
    headers: { "x-test-user": userId, ...(key ? { "x-test-key": key } : {}) },
  });
const context = (workspaceId = a, userId = alice) => ({ workspaceId, userId });

describe.skipIf(!url)("Shared Kaneo and Quills platform", () => {
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
      !parsed.pathname.startsWith("/quills_")
    )
      throw new Error("Use a disposable local quills_ database");
    pool = new Pool({ connectionString: url, max: 5 });
    await migrate(drizzle(pool), { migrationsFolder: resolve("drizzle") });
    await runQuillsMigrations(url!, resolve("drizzle/quills"));
    await database()
      .insert(kaneo.userTable)
      .values([
        { id: alice, name: "Alice", email: `${alice}@example.test` },
        { id: bob, name: "Bob", email: `${bob}@example.test` },
      ]);
    await database()
      .insert(kaneo.workspaceTable)
      .values([
        { id: a, name: "Alpha", slug: a, createdAt: new Date() },
        { id: b, name: "Beta", slug: b, createdAt: new Date() },
      ]);
    await database()
      .insert(kaneo.workspaceUserTable)
      .values([
        { workspaceId: a, userId: alice, role: "owner", joinedAt: new Date() },
        { workspaceId: b, userId: bob, role: "owner", joinedAt: new Date() },
      ]);
  }, 120000);
  afterAll(async () => {
    if (!pool) return;
    await pool.query(
      "DELETE FROM public.workspace WHERE id = ANY($1::text[])",
      [[a, b, `${suffix}_delete`]],
    );
    await pool.query('DELETE FROM public."user" WHERE id = ANY($1::text[])', [
      [alice, bob, `${suffix}_new`],
    ]);
    await pool.query(
      "DELETE FROM public.storage_cleanup WHERE object_key LIKE $1",
      [`${suffix}/%`],
    );
    await pool.end();
  });
  it("provisions a teammate actor and exposes the existing workspace through the API", async () => {
    const res = await request(`/quills/${a}/context`);
    expect(res.status).toBe(200);
    const value = await res.json();
    expect(value.workspace).toEqual({ id: a, name: "Alpha", slug: a });
    expect(value.actor.userId).toBe(alice);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int n FROM quills.principal WHERE workspace_id=$1 AND kaneo_user_id=$2",
          [a, alice],
        )
      ).rows[0].n,
    ).toBe(1);
    await Promise.all([1, 2].map(() => request(`/quills/${a}/context`)));
    expect(
      (
        await pool.query(
          "SELECT count(*)::int n FROM quills.principal WHERE workspace_id=$1 AND kaneo_user_id=$2",
          [a, alice],
        )
      ).rows[0].n,
    ).toBe(1);
    expect((await request(`/quills/${b}/context`)).status).toBe(404);
  });
  it("upgrades untouched default roles while preserving customized and malformed roles", async () => {
    const migration = await readFile(
      resolve("drizzle/quills/0004_kaneo_platform.sql"),
      "utf8",
    );
    const upgrade = migration.split("--> statement-breakpoint").at(-1)!;
    expect(upgrade).toContain("FROM public.workspace_role");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const [role, payload] of Object.entries(defaultRolePayloads)) {
        const legacy = Object.fromEntries(
          Object.entries(payload).filter(([resource]) => resource !== "quills"),
        );
        await client.query(
          "INSERT INTO public.workspace_role(id,workspace_id,role,permission,created_at) VALUES($1,$2,$3,$4,now())",
          [`${suffix}_${role}`, a, role, JSON.stringify(legacy)],
        );
      }
      const custom = JSON.stringify({ workspace: ["read"] });
      await client.query(
        "INSERT INTO public.workspace_role(id,workspace_id,role,permission,created_at) VALUES($1,$2,'viewer',$3,now()),($4,$2,'admin','invalid json',now())",
        [`${suffix}_custom`, b, custom, `${suffix}_invalid`],
      );
      await client.query(upgrade);
      const result = await client.query(
        "SELECT role,permission FROM public.workspace_role WHERE workspace_id=$1 AND role IN ('viewer','member','admin')",
        [a],
      );
      for (const row of result.rows)
        expect(JSON.parse(row.permission)).toEqual(
          defaultRolePayloads[row.role as keyof typeof defaultRolePayloads],
        );
      expect(result.rows).toHaveLength(3);
      expect(
        (
          await client.query(
            "SELECT permission FROM public.workspace_role WHERE id=$1",
            [`${suffix}_custom`],
          )
        ).rows[0].permission,
      ).toBe(custom);
      expect(
        (
          await client.query(
            "SELECT permission FROM public.workspace_role WHERE id=$1",
            [`${suffix}_invalid`],
          )
        ).rows[0].permission,
      ).toBe("invalid json");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
  it("rejects system seeding without an active workspace scope", async () => {
    await expect(
      withQuillsWorkspace(context(), async (db) => {
        await db.execute("SELECT set_config('quills.workspace_id', '', true)");
        await seedSystemData(db);
      }),
    ).rejects.toThrow("Quills seeding requires a workspace transaction");
  });
  it("uses Kaneo custom roles and applies role changes on the next request", async () => {
    await database()
      .insert(kaneo.workspaceRoleTable)
      .values({
        workspaceId: a,
        role: "quills_reader",
        permission: JSON.stringify({ workspace: ["read"], quills: ["read"] }),
        createdAt: new Date(),
      });
    await pool.query(
      "UPDATE public.workspace_member SET role='quills_reader' WHERE workspace_id=$1 AND user_id=$2",
      [a, alice],
    );
    expect((await request(`/quills/${a}/context`)).status).toBe(200);
    expect((await request(`/write/${a}`, alice, "POST")).status).toBe(403);
    await pool.query(
      "UPDATE public.workspace_role SET permission=$1 WHERE workspace_id=$2 AND role='quills_reader'",
      [JSON.stringify({ workspace: ["read"], quills: ["read", "create"] }), a],
    );
    expect((await request(`/write/${a}`, alice, "POST")).status).toBe(200);
    await pool.query(
      "UPDATE public.workspace_member SET role='owner' WHERE workspace_id=$1 AND user_id=$2",
      [a, alice],
    );
  });
  it("checks API-key scopes even for an owner", async () => {
    const key = `${suffix}_key`;
    await database().insert(kaneo.apikeyTable).values({
      id: key,
      key,
      name: "Test",
      referenceId: alice,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    try {
      expect(
        (await request(`/quills/${a}/context`, alice, "GET", key)).status,
      ).toBe(200);
      expect((await request(`/write/${a}`, alice, "POST", key)).status).toBe(
        403,
      );
    } finally {
      await database()
        .delete(kaneo.apikeyTable)
        .where(eq(kaneo.apikeyTable.id, key));
    }
  });
  it("enforces project restrictions and rejects a project from another workspace", async () => {
    const own = `${suffix}_project_a`,
      other = `${suffix}_project_b`;
    await database()
      .insert(kaneo.projectTable)
      .values([
        { id: own, workspaceId: a, name: "A", slug: "a" },
        { id: other, workspaceId: b, name: "B", slug: "b" },
      ]);
    expect(
      (await request(`/write/${a}?projectId=${other}`, alice, "POST")).status,
    ).toBe(404);
    await pool.query(
      "UPDATE public.workspace_member SET role='member' WHERE workspace_id=$1 AND user_id=$2",
      [a, alice],
    );
    await database()
      .insert(kaneo.workspaceMemberAccessTable)
      .values({ workspaceId: a, userId: alice, projectAccess: "selected" });
    try {
      expect(
        (await request(`/write/${a}?projectId=${own}`, alice, "POST")).status,
      ).toBe(403);
      await database()
        .insert(kaneo.workspaceMemberProjectTable)
        .values({ workspaceId: a, userId: alice, projectId: own });
      expect(
        (await request(`/write/${a}?projectId=${own}`, alice, "POST")).status,
      ).toBe(200);
    } finally {
      await pool.query(
        "UPDATE public.workspace_member SET role='owner' WHERE workspace_id=$1 AND user_id=$2",
        [a, alice],
      );
      await database()
        .delete(kaneo.workspaceMemberAccessTable)
        .where(eq(kaneo.workspaceMemberAccessTable.userId, alice));
    }
  });
  it("supports the existing instance-admin override and rejects it after demotion", async () => {
    await database()
      .update(kaneo.userTable)
      .set({ role: "admin" })
      .where(eq(kaneo.userTable.id, alice));
    try {
      expect((await request(`/quills/${b}/context`)).status).toBe(200);
    } finally {
      await database()
        .update(kaneo.userTable)
        .set({ role: null })
        .where(eq(kaneo.userTable.id, alice));
    }
    expect((await request(`/quills/${b}/context`)).status).toBe(404);
  });
  it("rolls actor provisioning back with a failed membership change", async () => {
    await expect(
      database().transaction(async (tx) => {
        await tx.insert(kaneo.workspaceUserTable).values({
          workspaceId: a,
          userId: bob,
          role: "member",
          joinedAt: new Date(),
        });
        throw new Error("rollback membership");
      }),
    ).rejects.toThrow("rollback membership");
    expect(
      (
        await pool.query(
          "SELECT id FROM quills.principal WHERE workspace_id=$1 AND kaneo_user_id=$2",
          [a, bob],
        )
      ).rowCount,
    ).toBe(0);
  });
  it("projects canonical workspace and profile changes without a Quills write", async () => {
    await pool.query(
      "UPDATE public.workspace SET name='Renamed',slug=$1 WHERE id=$2",
      [`${a}_renamed`, a],
    );
    await pool.query('UPDATE public."user" SET name=$1,image=$2 WHERE id=$3', [
      "Alice renamed",
      "https://example.test/avatar.png",
      alice,
    ]);
    const projected = await withQuillsWorkspace(
      context(),
      async (db, actor) => {
        await db.update(settings).set({ name: "Untrusted override" });
        return {
          settings: (await db.select().from(settings))[0],
          actor: (
            await db
              .select()
              .from(principal)
              .where(eq(principal.id, actor.principalId))
          )[0],
        };
      },
    );
    expect(projected.settings?.name).toBe("Renamed");
    expect(projected.settings?.slug).toBe(`${a}_renamed`);
    expect(projected.actor?.displayName).toBe("Alice renamed");
    expect(projected.actor?.avatarUrl).toBe("https://example.test/avatar.png");
  });
  it("preserves actor history across removal, reinvitation and account deletion", async () => {
    const id = `${suffix}_new`;
    await database()
      .insert(kaneo.userTable)
      .values({ id, name: "New teammate", email: `${id}@example.test` });
    const add = () =>
      database().insert(kaneo.workspaceUserTable).values({
        workspaceId: a,
        userId: id,
        role: "member",
        joinedAt: new Date(),
      });
    await add();
    const first = await withQuillsWorkspace(
      context(a, id),
      async (_db, actor) => actor.principalId,
    );
    await pool.query(
      "DELETE FROM public.workspace_member WHERE workspace_id=$1 AND user_id=$2",
      [a, id],
    );
    expect((await request(`/quills/${a}/context`, id)).status).toBe(404);
    await add();
    expect(
      await withQuillsWorkspace(
        context(a, id),
        async (_db, actor) => actor.principalId,
      ),
    ).toBe(first);
    await database().delete(kaneo.userTable).where(eq(kaneo.userTable.id, id));
    const historical = await withQuillsWorkspace(
      context(),
      async (db) =>
        (await db.select().from(principal).where(eq(principal.id, first)))[0],
    );
    expect(historical?.kaneoUserId).toBeNull();
    expect(historical?.displayName).toBe("Deleted user");
  });
  it("collects originals and previews and protects objects still referenced by another workspace", async () => {
    const key = `${suffix}/shared`,
      preview = `${suffix}/preview`;
    const upload = (workspaceId: string, userId: string) =>
      withQuillsWorkspace(context(workspaceId, userId), (db) =>
        db.insert(files).values({
          storageKey: key,
          name: "File",
          contentType: "text/plain",
          family: "text",
          size: 1,
          sha256: "test",
          source: "api",
          meta: { thumbKey: preview },
        }),
      );
    await upload(a, alice);
    await upload(b, bob);
    expect(await listWorkspaceObjectKeys(a)).toEqual(
      expect.arrayContaining([key, preview]),
    );
    await withQuillsWorkspace(context(), (db) =>
      db.delete(files).where(eq(files.storageKey, key)),
    );
    await retryStorageCleanup();
    expect(deleteS3Object).not.toHaveBeenCalledWith(key);
    await withQuillsWorkspace(context(b, bob), (db) =>
      db.delete(files).where(eq(files.storageKey, key)),
    );
    await retryStorageCleanup();
    expect(deleteS3Object).toHaveBeenCalledWith(key);
    expect(deleteS3Object).toHaveBeenCalledWith(preview);
    await expect(
      withQuillsWorkspace(context(), (db) =>
        db.execute("SELECT * FROM quills.storage_references()"),
      ),
    ).rejects.toThrow();
  });
  it("cascades complete feature data and queues files when the workspace is deleted", async () => {
    const id = `${suffix}_delete`,
      key = `${suffix}/export`;
    await database()
      .insert(kaneo.workspaceTable)
      .values({ id, name: "Delete", slug: id, createdAt: new Date() });
    await database().insert(kaneo.workspaceUserTable).values({
      workspaceId: id,
      userId: alice,
      role: "owner",
      joinedAt: new Date(),
    });
    await withQuillsWorkspace(context(id), (db, actor) =>
      db.insert(exportRuns).values({
        fileName: "export.zip",
        s3Key: key,
        initiatedByPrincipalId: actor.principalId,
      }),
    );
    await database()
      .delete(kaneo.workspaceTable)
      .where(eq(kaneo.workspaceTable.id, id));
    expect(
      (
        await pool.query(
          "SELECT count(*)::int n FROM quills.principal WHERE workspace_id=$1",
          [id],
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      (
        await pool.query(
          "SELECT object_key FROM public.storage_cleanup WHERE object_key=$1",
          [key],
        )
      ).rowCount,
    ).toBe(1);
  });
});
