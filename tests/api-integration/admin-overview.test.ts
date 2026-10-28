import { createHash, randomUUID } from "node:crypto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { eq } from "drizzle-orm";
import db, { schema } from "../../apps/api/src/database";
import type { z } from "../../apps/api/src/openapi";
import type { adminOverviewSchema } from "../../apps/api/src/admin/overview/response";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { resetTestDatabase } from "./helpers/database";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

type Overview = z.infer<typeof adminOverviewSchema>;
const smtp = vi.hoisted(() => ({
  verify: vi.fn(async () => ({ status: "not_configured" })),
}));
const redis = vi.hoisted(() => ({ ping: vi.fn(async () => "PONG") }));
vi.mock("@kaneo/email", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  verifySmtpConnection: smtp.verify,
}));
vi.mock("../../apps/api/src/redis", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRedisPub: () => ({ ping: redis.ping }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  smtp.verify.mockReset().mockResolvedValue({ status: "not_configured" });
  redis.ping.mockReset().mockResolvedValue("PONG");
  for (const name of [
    "REDIS_URL",
    "REDIS_HOST",
    "REDIS_SENTINELS",
    "REDIS_CLUSTER_NODES",
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ])
    vi.stubEnv(name, "");
});
afterEach(() => vi.unstubAllEnvs());

async function overview() {
  const response = await projectAccessApi()("/admin/overview");
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return (await response.json()) as Overview;
}

async function addUser(
  id: string,
  overrides: Partial<typeof schema.userTable.$inferInsert> = {},
) {
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id,
      name: id,
      email: `${id}@example.com`,
      ...overrides,
    })
    .returning();
  return user;
}

async function addSession(userId: string, daysAgo: number) {
  await db.insert(schema.sessionTable).values({
    id: randomUUID(),
    token: `private-session-${randomUUID()}`,
    userId,
    updatedAt: new Date(Date.now() - daysAgo * 86_400_000),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
}

describe("admin overview", () => {
  it("requires an administrator session and rejects administrator API keys", async () => {
    mockAnonymousSession();
    expect((await projectAccessApi()("/admin/overview")).status).toBe(401);
    const user = await addUser("member");
    mockAuthenticatedSession(user);
    expect((await projectAccessApi()("/admin/overview")).status).toBe(403);
    const admin = await createInstanceAdmin();
    const key = `test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: admin.id,
      userId: admin.id,
      key: createHash("sha256").update(key).digest("base64url"),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockAnonymousSession();
    expect(
      (await projectAccessApi({ "x-api-key": key })("/admin/overview")).status,
    ).toBe(403);
    expect(smtp.verify).not.toHaveBeenCalled();
  });

  it("counts recently active users once, excludes current bans, and includes expired bans", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    await addUser("active");
    await addUser("old");
    await addUser("never");
    await addUser("expired", {
      banned: true,
      banExpires: new Date(Date.now() - 86_400_000),
    });
    await addUser("indefinite", { banned: true });
    await addUser("future", {
      banned: true,
      banExpires: new Date(Date.now() + 86_400_000),
    });
    await addUser("null-ban", { banned: null });
    await addSession("active", 1);
    await addSession("active", 2);
    await addSession("old", 31);
    await addSession("expired", 29);
    await addSession("indefinite", 0);
    await addSession("future", 0);
    await addSession("null-ban", 0);
    await db.insert(schema.workspaceTable).values([
      { id: "active", name: "Active", slug: "active", createdAt: new Date() },
      {
        id: "archived",
        name: "Archived",
        slug: "archived",
        createdAt: new Date(),
        archivedAt: new Date(),
      },
    ]);

    const body = await overview();
    expect(body.users).toEqual({
      total: 8,
      activeLast30Days: 3,
      deactivated: 2,
    });
    expect(body.workspaces).toEqual({ total: 2, archived: 1 });
    expect(body.services).toMatchObject({
      api: "ok",
      database: "ok",
      redis: "not_configured",
      email: "not_configured",
      storage: "not_configured",
    });
    expect(body.warnings).toEqual([
      "smtp_not_configured",
      "registration_without_email",
      "no_second_admin",
    ]);
  });

  it("limits recent lists to five with stable newest-first ordering and only summary fields", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    await db
      .update(schema.userTable)
      .set({ createdAt: new Date("2020-01-01") })
      .where(eq(schema.userTable.id, admin.id));
    for (let i = 0; i < 7; i++) {
      await addUser(`recent-${i}`, {
        createdAt: new Date("2026-01-01"),
        banReason: "private-ban-reason",
      });
      await db.insert(schema.adminAuditLogTable).values({
        id: `audit-${i}`,
        action: "user.updated",
        actorUserId: admin.id,
        actorName: admin.name,
        actorEmail: admin.email,
        targetType: "user",
        targetId: `recent-${i}`,
        targetLabel: `recent-${i}@example.com`,
        createdAt: new Date("2026-01-01"),
        metadata: { internal: "private-audit-metadata" },
        ipAddress: "192.0.2.1",
        userAgent: "private-user-agent",
      });
    }
    await addSession(admin.id, 0);
    const body = await overview();
    expect(body.recentUsers.map((u) => u.id)).toEqual(
      [6, 5, 4, 3, 2].map((i) => `recent-${i}`),
    );
    expect(body.recentActions.map((a) => a.id)).toEqual(
      [6, 5, 4, 3, 2].map((i) => `audit-${i}`),
    );
    expect(Object.keys(body.recentUsers[0]).sort()).toEqual([
      "createdAt",
      "email",
      "id",
      "image",
      "name",
    ]);
    expect(Object.keys(body.recentActions[0]).sort()).toEqual([
      "action",
      "actor",
      "createdAt",
      "id",
      "targetId",
      "targetLabel",
      "targetType",
    ]);
    const text = JSON.stringify(body);
    for (const secret of [
      "private-session-",
      "private-ban-reason",
      "private-audit-metadata",
      "private-user-agent",
      "192.0.2.1",
    ])
      expect(text).not.toContain(secret);
  });

  it("derives warnings from real service configuration without returning secrets", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    vi.stubEnv(
      "REDIS_URL",
      "redis://:private-redis-password@redis.internal.test:6379",
    );
    redis.ping.mockRejectedValue(
      Object.assign(new Error("private-redis-password"), {
        code: "ECONNREFUSED",
      }),
    );
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "private-s3-secret");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "private-google-secret");
    const body = await overview();
    expect(body.services).toMatchObject({ redis: "down", storage: "warning" });
    expect(body.warnings).toContain("redis_unreachable");
    expect(body.warnings).toContain("storage_incomplete");
    for (const secret of [
      "private-redis-password",
      "redis.internal.test",
      "private-s3-secret",
      "private-google-secret",
    ])
      expect(JSON.stringify(body)).not.toContain(secret);
  });

  it("does not warn about closed registration, optional services, or a second enabled admin", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    await addUser("expired-admin", {
      role: "user,admin",
      banned: true,
      banExpires: new Date(Date.now() - 86_400_000),
    });
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    smtp.verify.mockResolvedValue({ status: "ok" });
    const body = await overview();
    expect(body.warnings).toEqual([]);
    expect(body.recentActions).toEqual([]);
    expect(body.workspaces).toEqual({ total: 0, archived: 0 });
  });

  it("does not count deactivated admins as a second administrator", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    await addUser("disabled-admin", { role: "admin", banned: true });
    expect((await overview()).warnings).toContain("no_second_admin");
  });
});
