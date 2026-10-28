import { beforeEach, describe, expect, it } from "vite-plus/test";
import { recordAdminAction } from "../../apps/api/src/admin/audit/record-admin-action";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

type AuditLogPage = {
  total: number;
  entries: { id: string; action: string; actor: { id: string | null } }[];
};

async function list(query = "") {
  const response = await projectAccessApi()(`/admin/audit-log${query}`);
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as AuditLogPage;
}

async function seed(actorId: string) {
  const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 12, minutes));
  await db.insert(schema.adminAuditLogTable).values([
    {
      id: "oldest",
      action: "user.deleted",
      targetType: "user",
      targetId: "u1",
      createdAt: at(1),
    },
    {
      id: "middle",
      actorUserId: actorId,
      action: "workspace.member_added",
      targetType: "workspace",
      targetId: "w1",
      createdAt: at(2),
    },
    {
      id: "newest",
      actorUserId: actorId,
      action: "user.role_changed",
      targetType: "user",
      targetId: "u2",
      createdAt: at(3),
    },
    {
      id: "lookalike",
      action: "users_import.done",
      targetType: "user",
      createdAt: at(0),
    },
  ]);
}

beforeEach(resetTestDatabase);

describe("GET /api/admin/audit-log", () => {
  it("is limited to instance administrator sessions", async () => {
    mockAnonymousSession();
    expect((await projectAccessApi()("/admin/audit-log")).status).toBe(401);

    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    expect((await projectAccessApi()("/admin/audit-log")).status).toBe(403);
  });

  it("rejects an administrator's API key", async () => {
    const admin = await createInstanceAdmin();
    const { key } = await auth.api.createApiKey({
      body: { userId: admin.id, name: "Audit log test" },
    });
    const { app } = createApp();

    for (const headers of [
      { "x-api-key": key },
      { authorization: `Bearer ${key}` },
    ]) {
      const response = await app.request("/api/admin/audit-log", { headers });
      expect(response.status).toBe(403);
    }
  });

  it("pages newest first and filters by category, action, actor, and target", async () => {
    const admin = await createInstanceAdmin();
    await seed(admin.id);
    mockAuthenticatedSession(admin);
    const ids = (page: AuditLogPage) => page.entries.map((entry) => entry.id);

    const all = await list();
    expect(ids(all)).toEqual(["newest", "middle", "oldest", "lookalike"]);
    expect(all.total).toBe(4);

    const second = await list("?limit=2&page=2");
    expect(ids(second)).toEqual(["oldest", "lookalike"]);
    expect(second.total).toBe(4);

    expect(ids(await list("?action=user"))).toEqual(["newest", "oldest"]);
    expect(ids(await list("?action=user.deleted"))).toEqual(["oldest"]);
    expect(ids(await list(`?actorId=${admin.id}`))).toEqual([
      "newest",
      "middle",
    ]);
    expect(ids(await list("?targetType=workspace&targetId=w1"))).toEqual([
      "middle",
    ]);
  });

  it("returns recorded entries with actor snapshots", async () => {
    const admin = await createInstanceAdmin();
    await recordAdminAction({
      actorUserId: admin.id,
      action: "user.deactivated",
      targetType: "user",
      targetId: "someone",
      targetLabel: "someone@example.com",
      metadata: { reason: "Left", apiKey: "kn_secret", password: "hunter2" },
      ipAddress: "203.0.113.9",
      userAgent: "agent",
    });
    mockAuthenticatedSession(admin);

    const page = await list();
    expect(page.entries).toEqual([
      {
        id: expect.any(String),
        createdAt: expect.any(String),
        action: "user.deactivated",
        actor: { id: admin.id, name: admin.name, email: admin.email },
        targetType: "user",
        targetId: "someone",
        targetLabel: "someone@example.com",
        metadata: { reason: "Left" },
        ipAddress: "203.0.113.9",
        userAgent: "agent",
      },
    ]);
  });

  it("rejects malformed filters", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();

    expect((await request("/admin/audit-log?action=user%25")).status).toBe(400);
    expect((await request("/admin/audit-log?limit=500")).status).toBe(400);
  });
});
