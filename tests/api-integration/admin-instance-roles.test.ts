import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { readErrorBody } from "./helpers/error-body";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import {
  adminApi,
  insertInstanceRole,
  insertUser,
  signInWithRole,
} from "./helpers/admin/instance-roles";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);

async function roleOf(userId: string) {
  const [user] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return user?.role;
}

function authAdmin(path: string, body: unknown, cookie: string) {
  return auth.handler(
    new Request(`http://localhost:1337/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        cookie,
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("custom instance roles", () => {
  it("are created, renamed with their users, and deleted once unassigned, with audit entries", async () => {
    const { app } = createApp();
    const admin = await signInWithRole(app, "admin");

    const created = await admin.api("/roles", {
      method: "POST",
      body: { name: "support", permissions: ["users:read", "audit:read"] },
    });
    expect(created.status).toBe(201);
    const role = (await created.json()) as { id: string; userCount: number };
    expect(role).toMatchObject({
      name: "support",
      permissions: ["users:read", "audit:read"],
      userCount: 0,
    });

    const member = await insertUser("support");
    const renamed = await admin.api(`/roles/${role.id}`, {
      method: "PUT",
      body: { name: "help-desk", permissions: ["users:read"] },
    });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({
      name: "help-desk",
      permissions: ["users:read"],
      userCount: 1,
    });
    expect(await roleOf(member.id)).toBe("help-desk");

    const blocked = await admin.api(`/roles/${role.id}`, { method: "DELETE" });
    expect(blocked.status).toBe(409);
    expect(await readErrorBody(blocked)).toMatchObject({ code: "ROLE_IN_USE" });

    await db
      .update(schema.userTable)
      .set({ role: "user" })
      .where(eq(schema.userTable.id, member.id));
    const deleted = await admin.api(`/roles/${role.id}`, { method: "DELETE" });
    expect(deleted.status).toBe(200);

    const entries = (await readAuditLog()).map((entry) => ({
      action: entry.action,
      targetType: entry.targetType,
      targetLabel: entry.targetLabel,
      metadata: entry.metadata,
    }));
    expect(entries).toEqual([
      {
        action: "role.created",
        targetType: "role",
        targetLabel: "support",
        metadata: { permissions: ["users:read", "audit:read"] },
      },
      {
        action: "role.deleted",
        targetType: "role",
        targetLabel: "help-desk",
        metadata: { permissions: ["users:read"] },
      },
      {
        action: "role.updated",
        targetType: "role",
        targetLabel: "help-desk",
        metadata: {
          name: { from: "support", to: "help-desk" },
          added: [],
          removed: ["audit:read"],
        },
      },
    ]);
  });

  it("reject reserved, taken, and invalid names and role management permissions", async () => {
    const { app } = createApp();
    const admin = await signInWithRole(app, "admin");
    await insertInstanceRole("support", []);

    const cases = [
      { body: { name: "admin", permissions: [] }, status: 409 },
      { body: { name: "user", permissions: [] }, status: 409 },
      { body: { name: "support", permissions: [] }, status: 409 },
      { body: { name: "Support Team", permissions: [] }, status: 400 },
      { body: { name: "ops", permissions: ["roles:manage"] }, status: 400 },
      { body: { name: "ops", permissions: ["users:fly"] }, status: 400 },
    ];
    for (const { body, status } of cases) {
      const response = await admin.api("/roles", { method: "POST", body });
      expect(response.status, JSON.stringify(body)).toBe(status);
    }
    expect(await readAuditLog()).toEqual([]);
  });

  it("are listed with their user counts and filter the user directory", async () => {
    const { app } = createApp();
    const admin = await signInWithRole(app, "admin");
    await insertInstanceRole("support", ["users:read"]);
    const supporter = await insertUser("support");
    const plain = await insertUser("user");

    const list = await admin.api("/roles");
    expect(await list.json()).toMatchObject({
      roles: [{ name: "support", userCount: 1 }],
    });

    const ids = async (role: string) => {
      const response = await admin.api(`/users?role=${role}`);
      const body = (await response.json()) as { users: { id: string }[] };
      return body.users.map((user) => user.id).sort();
    };
    expect(await ids("support")).toEqual([supporter.id]);
    expect(await ids("user")).toEqual([plain.id]);
    expect(await ids("admin")).toEqual([admin.userId]);
  });

  it.each(["create", "rename"])(
    "rejects %s of a role name already held by users",
    async (operation) => {
      const { app } = createApp();
      const admin = await signInWithRole(app, "admin");
      const stale = await insertUser("user,legacy-support");
      const role = await insertInstanceRole("support", []);
      const assigned = await insertUser("support");

      const response = await admin.api(
        operation === "create" ? "/roles" : `/roles/${role.id}`,
        {
          method: operation === "create" ? "POST" : "PUT",
          body: { name: "legacy-support", permissions: ["users:read"] },
        },
      );

      expect(response.status).toBe(409);
      expect(await readErrorBody(response)).toMatchObject({
        code: "ROLE_NAME_IN_USE",
        message: "Users already have this role name. Change their role first.",
      });
      expect(await roleOf(stale.id)).toBe("user,legacy-support");
      expect(await roleOf(assigned.id)).toBe("support");
      const roles = await db.select().from(schema.instanceRoleTable);
      expect(roles).toMatchObject([{ name: "support", permissions: [] }]);
      expect(await readAuditLog()).toEqual([]);
    },
  );

  it("grant only their permissions through the access endpoint", async () => {
    const { app } = createApp();
    await insertInstanceRole("auditor", ["audit:read", "system:read"]);
    const auditor = await signInWithRole(app, "auditor");
    const plain = await signInWithRole(app, "user");
    const admin = await signInWithRole(app, "admin");

    const permissionsOf = async (api: typeof auditor.api) =>
      ((await (await api("/access")).json()) as { permissions: string[] })
        .permissions;
    expect(await permissionsOf(auditor.api)).toEqual([
      "audit:read",
      "system:read",
    ]);
    expect(await permissionsOf(plain.api)).toEqual([]);
    expect(await permissionsOf(admin.api)).toContain("roles:manage");

    // Changes apply to the next request.
    await db
      .update(schema.instanceRoleTable)
      .set({ permissions: [] })
      .where(eq(schema.instanceRoleTable.name, "auditor"));
    expect((await auditor.api("/audit-log")).status).toBe(403);
  });

  it("reject API keys, even from administrators", async () => {
    const { app } = createApp();
    const admin = await signInWithRole(app, "admin");
    const target = await insertUser();
    const { key } = await auth.api.createApiKey({
      body: { userId: admin.userId, name: "Roles test" },
    });
    const role = await insertInstanceRole("support", []);
    const requests = [
      { path: "/access" },
      { path: "/roles" },
      {
        path: "/roles",
        method: "POST",
        body: { name: "ops", permissions: [] },
      },
      { path: `/roles/${role.id}`, method: "DELETE" },
      { path: `/users/${target.id}`, method: "PATCH", body: { name: "X" } },
      { path: `/users/${target.id}/deactivate`, method: "POST" },
      { path: `/users/${target.id}`, method: "DELETE" },
    ];
    for (const headers of [
      { "x-api-key": key },
      { authorization: `Bearer ${key}` },
    ]) {
      const api = adminApi(app, headers);
      for (const request of requests) {
        const response = await api(request.path, request);
        expect(response.status, `${request.method} ${request.path}`).toBe(403);
      }
    }
    expect(await readAuditLog()).toEqual([]);
  });
});

describe("instance role escalation", () => {
  it("lets a custom role assign only roles within its own permissions", async () => {
    const { app } = createApp();
    await insertInstanceRole("manager", ["users:read", "users:update"]);
    await insertInstanceRole("reader", ["users:read"]);
    await insertInstanceRole("auditor", ["audit:read"]);
    const manager = await signInWithRole(app, "manager");
    const target = await insertUser();

    const assign = (role: string) =>
      manager.api(`/users/${target.id}`, { method: "PATCH", body: { role } });

    const toAdmin = await assign("admin");
    expect(toAdmin.status).toBe(403);
    expect(await readErrorBody(toAdmin)).toMatchObject({
      code: "ADMIN_ROLE_REQUIRED",
    });
    const wider = await assign("auditor");
    expect(wider.status).toBe(403);
    expect(await readErrorBody(wider)).toMatchObject({
      code: "ROLE_EXCEEDS_YOUR_PERMISSIONS",
    });
    const unknown = await assign("ghost");
    expect(unknown.status).toBe(400);
    expect(await roleOf(target.id)).toBe("user");

    expect((await assign("reader")).status).toBe(200);
    expect(await roleOf(target.id)).toBe("reader");
    expect(
      (await readAuditLog()).map(({ action, metadata }) => ({
        action,
        metadata,
      })),
    ).toEqual([
      { action: "user.role_changed", metadata: { from: "user", to: "reader" } },
    ]);
  });

  it("keeps a custom role away from users with more permissions", async () => {
    const { app } = createApp();
    await insertInstanceRole("support", [
      "users:read",
      "users:update",
      "users:disable",
      "users:delete",
      "users:credentials",
      "users:sessions",
    ]);
    await insertInstanceRole("auditor", ["audit:read"]);
    const support = await signInWithRole(app, "support");
    const admin = await insertUser("admin");
    const auditor = await insertUser("auditor");

    for (const target of [admin, auditor]) {
      for (const request of [
        { path: `/users/${target.id}`, method: "PATCH", body: { name: "X" } },
        { path: `/users/${target.id}/deactivate`, method: "POST" },
        { path: `/users/${target.id}`, method: "DELETE" },
        { path: `/users/${target.id}/sessions`, method: "DELETE" },
        { path: `/users/${target.id}/email-verified`, method: "PUT" },
      ]) {
        const response = await support.api(request.path, request);
        expect(response.status, `${target.role} ${request.path}`).toBe(403);
        expect(await readErrorBody(response)).toMatchObject({
          code: "USER_HAS_MORE_PERMISSIONS",
        });
      }
    }
    expect(await readAuditLog()).toEqual([]);
  });

  it("does not let a custom role manage roles or use better-auth admin endpoints", async () => {
    const { app } = createApp();
    await insertInstanceRole("support", [
      "users:read",
      "users:update",
      "users:disable",
      "users:delete",
    ]);
    const support = await signInWithRole(app, "support");
    const target = await insertUser();

    const created = await support.api("/roles", {
      method: "POST",
      body: { name: "ops", permissions: [] },
    });
    expect(created.status).toBe(403);

    for (const [path, body] of [
      ["/admin/update-user", { userId: target.id, data: { name: "X" } }],
      ["/admin/set-role", { userId: target.id, role: "admin" }],
      ["/admin/ban-user", { userId: target.id }],
      ["/admin/remove-user", { userId: target.id }],
      [
        "/admin/create-user",
        { email: "x@example.com", name: "X", password: "password1234" },
      ],
    ] as const) {
      const response = await authAdmin(path, body, support.cookies);
      expect(response.status, path).toBe(403);
    }
    expect(await roleOf(target.id)).toBe("user");
  });

  it("lets better-auth admin endpoints assign only known roles", async () => {
    const { app } = createApp();
    const admin = await signInWithRole(app, "admin");
    await insertInstanceRole("support", []);
    const target = await insertUser();

    for (const [path, body] of [
      ["/admin/set-role", { userId: target.id, role: "ghost" }],
      ["/admin/set-role", { userId: target.id, role: ["user", "ghost"] }],
      ["/admin/update-user", { userId: target.id, data: { role: "ghost" } }],
    ] as const) {
      const response = await authAdmin(path, body, admin.cookies);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toMatchObject({ code: "UNKNOWN_ROLE" });
    }
    const assigned = await authAdmin(
      "/admin/set-role",
      { userId: target.id, role: "support" },
      admin.cookies,
    );
    expect(assigned.status).toBe(200);
    expect(await roleOf(target.id)).toBe("support");
  });

  it("keeps the last administrator and your own role", async () => {
    const { app } = createApp();
    const admin = await signInWithRole(app, "admin");
    const other = await insertUser("admin");

    const self = await admin.api(`/users/${admin.userId}`, {
      method: "PATCH",
      body: { role: "user" },
    });
    expect(self.status).toBe(400);
    expect(await readErrorBody(self)).toMatchObject({
      code: "YOU_CANNOT_CHANGE_YOUR_OWN_ROLE",
    });

    expect(
      (
        await admin.api(`/users/${other.id}`, {
          method: "PATCH",
          body: { role: "user" },
        })
      ).status,
    ).toBe(200);
    expect(await roleOf(admin.userId)).toBe("admin");
  });
});

describe("admin account actions", () => {
  it("update, deactivate, reactivate, and delete a user with one audit entry each", async () => {
    const { app } = createApp();
    const admin = await signInWithRole(app, "admin");
    const target = await signInWithRole(app, "user");

    const updated = await admin.api(`/users/${target.userId}`, {
      method: "PATCH",
      body: { name: "Renamed", email: "Renamed@Example.com" },
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      name: "Renamed",
      email: "renamed@example.com",
      emailVerified: false,
    });

    const deactivated = await admin.api(`/users/${target.userId}/deactivate`, {
      method: "POST",
    });
    expect(deactivated.status).toBe(200);
    expect(await deactivated.json()).toMatchObject({ banned: true });
    const sessions = await db
      .select()
      .from(schema.sessionTable)
      .where(eq(schema.sessionTable.userId, target.userId));
    expect(sessions).toEqual([]);
    // Deactivating again records nothing new.
    await admin.api(`/users/${target.userId}/deactivate`, { method: "POST" });

    const reactivated = await admin.api(`/users/${target.userId}/reactivate`, {
      method: "POST",
    });
    expect(await reactivated.json()).toMatchObject({ banned: false });

    const self = await admin.api(`/users/${admin.userId}`, {
      method: "DELETE",
    });
    expect(self.status).toBe(400);
    const deleted = await admin.api(`/users/${target.userId}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);
    expect(await roleOf(target.userId)).toBeUndefined();

    expect((await readAuditLog()).map((entry) => entry.action)).toEqual([
      "user.deactivated",
      "user.deleted",
      "user.reactivated",
      "user.updated",
    ]);
  });

  it("rejects an email another user has", async () => {
    const { app } = createApp();
    const admin = await signInWithRole(app, "admin");
    const target = await insertUser();
    const response = await admin.api(`/users/${target.id}`, {
      method: "PATCH",
      body: { email: admin.email.toUpperCase() },
    });
    expect(response.status).toBe(409);
  });
});
