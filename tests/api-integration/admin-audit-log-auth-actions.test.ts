import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

type App = ReturnType<typeof createApp>["app"];

let app: App;
let admin: { userId: string; cookies: string };
let target: { userId: string; cookies: string };

function call(path: string, body: unknown, headers: Record<string, string>) {
  return app.request(`/api/auth/admin/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      "user-agent": "audit-test-agent",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const asAdmin = (path: string, body: unknown) =>
  call(path, body, { cookie: admin.cookies });

async function expectOk(response: Response) {
  expect(response.status, await response.clone().text()).toBe(200);
}

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
  admin = await signUpWithSession(app, {
    email: "admin@example.com",
    name: "Ada Admin",
    role: "admin",
  });
  target = await signUpWithSession(app, {
    email: "target@example.com",
    name: "Tom Target",
    role: "user",
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("audit of better-auth admin endpoints", () => {
  it("records role changes separately from other profile updates", async () => {
    await expectOk(
      await asAdmin("update-user", {
        userId: target.userId,
        data: { name: "Tim Target", email: "tim@example.com", role: "admin" },
      }),
    );

    const rows = await readAuditLog();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      action: "user.role_changed",
      actorUserId: admin.userId,
      actorName: "Ada Admin",
      actorEmail: "admin@example.com",
      targetType: "user",
      targetId: target.userId,
      targetLabel: "tim@example.com",
      metadata: { from: "user", to: "admin" },
      userAgent: "audit-test-agent",
    });
    expect(rows[1]).toMatchObject({
      action: "user.updated",
      targetId: target.userId,
      metadata: {
        fields: ["name", "email"],
        changes: {
          name: { from: "Tom Target", to: "Tim Target" },
          email: { from: "target@example.com", to: "tim@example.com" },
        },
      },
    });
    expect(rows[0].createdAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("records nothing when an update changes nothing", async () => {
    await expectOk(
      await asAdmin("update-user", {
        userId: target.userId,
        data: { name: "Tom Target", email: "target@example.com", role: "user" },
      }),
    );

    expect(await readAuditLog()).toEqual([]);
  });

  it("records set-role, deactivation, and reactivation", async () => {
    await expectOk(
      await asAdmin("set-role", { userId: target.userId, role: "admin" }),
    );
    await expectOk(
      await asAdmin("ban-user", {
        userId: target.userId,
        banReason: "Left the company",
      }),
    );
    await expectOk(await asAdmin("unban-user", { userId: target.userId }));

    const rows = await readAuditLog();
    expect(rows.map((row) => [row.action, row.metadata])).toEqual([
      ["user.deactivated", { reason: "Left the company", expiresAt: null }],
      ["user.reactivated", null],
      ["user.role_changed", { from: "user", to: "admin" }],
    ]);
    expect(rows.every((row) => row.targetId === target.userId)).toBe(true);
  });

  it("keeps the label of a deleted user", async () => {
    await expectOk(await asAdmin("remove-user", { userId: target.userId }));

    const [row] = await readAuditLog();
    expect(row).toMatchObject({
      action: "user.deleted",
      targetId: target.userId,
      targetLabel: "target@example.com",
      metadata: { name: "Tom Target" },
    });
  });

  it("never stores passwords or session tokens", async () => {
    const password = "a-brand-new-secret-password";
    await expectOk(
      await asAdmin("set-user-password", {
        userId: target.userId,
        newPassword: password,
      }),
    );
    const created = await asAdmin("create-user", {
      email: "new@example.com",
      name: "New Person",
      password,
      role: "user",
    });
    await expectOk(created);
    const { user: createdUser } = (await created.json()) as {
      user: { id: string };
    };
    const [session] = await db
      .select()
      .from(schema.sessionTable)
      .where(eq(schema.sessionTable.userId, target.userId));
    await expectOk(
      await asAdmin("revoke-user-session", { sessionToken: session.token }),
    );
    await signUpWithSession(app, {
      email: "again@example.com",
      name: "Again",
      role: "user",
    });
    await expectOk(
      await asAdmin("revoke-user-sessions", { userId: target.userId }),
    );
    const impersonation = await asAdmin("impersonate-user", {
      userId: createdUser.id,
    });
    await expectOk(impersonation);
    const { session: impersonated } = (await impersonation.json()) as {
      session: { token: string };
    };

    const rows = await readAuditLog();
    expect(rows.map((row) => row.action)).toEqual([
      "session.revoked",
      "session.revoked_all",
      "user.created",
      "user.impersonated",
      "user.password_set",
    ]);
    expect(rows[0]).toMatchObject({
      targetId: target.userId,
      metadata: { sessionId: session.id },
    });
    expect(rows[2]).toMatchObject({
      targetId: createdUser.id,
      targetLabel: "new@example.com",
      metadata: { name: "New Person", role: "user" },
    });
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain(password);
    expect(stored).not.toContain(session.token);
    expect(stored).not.toContain(impersonated.token);
    expect(stored).not.toMatch(/password"|token"/i);
  });

  it("records nothing for forbidden or failed admin calls", async () => {
    const asTarget = (path: string, body: unknown) =>
      call(path, body, { cookie: target.cookies });

    expect((await asTarget("ban-user", { userId: admin.userId })).status).toBe(
      403,
    );
    expect(
      (await asTarget("set-role", { userId: admin.userId, role: "user" }))
        .status,
    ).toBe(403);
    expect(
      (await asTarget("remove-user", { userId: admin.userId })).status,
    ).toBe(403);
    expect((await asAdmin("ban-user", { userId: admin.userId })).status).toBe(
      400,
    );
    expect(
      (
        await asAdmin("update-user", {
          userId: admin.userId,
          data: { role: "user" },
        })
      ).status,
    ).toBe(400);
    expect(
      (await asAdmin("unban-user", { userId: "missing-user" })).status,
    ).toBe(404);
    expect((await call("ban-user", { userId: target.userId }, {})).status).toBe(
      401,
    );

    const { key } = await auth.api.createApiKey({
      body: { userId: admin.userId, name: "Audit test" },
    });
    expect(
      (await call("ban-user", { userId: target.userId }, { "x-api-key": key }))
        .status,
    ).toBe(403);

    expect(await readAuditLog()).toEqual([]);
  });

  it("keeps the actor snapshot after the administrator is deleted", async () => {
    await expectOk(
      await asAdmin("set-role", { userId: target.userId, role: "admin" }),
    );
    await db
      .delete(schema.userTable)
      .where(eq(schema.userTable.id, admin.userId));

    const [row] = await readAuditLog();
    expect(row).toMatchObject({
      actorUserId: null,
      actorName: "Ada Admin",
      actorEmail: "admin@example.com",
    });
  });

  it("records the client address resolved from the transport", async () => {
    vi.stubEnv("TRUSTED_PROXIES", "127.0.0.0/8");
    ({ app } = createApp());
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
    await once(server, "listening");
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${port}/api/auth/admin/ban-user`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:5173",
            cookie: admin.cookies,
            "x-kaneo-client-ip": "1.2.3.4",
            "x-forwarded-for": "203.0.113.9",
          },
          body: JSON.stringify({ userId: target.userId }),
        },
      );
      expect(response.status, await response.text()).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    const [row] = await readAuditLog();
    expect(row.ipAddress).toBe("203.0.113.9");
  });
});
