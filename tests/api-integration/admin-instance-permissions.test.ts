import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { readErrorBody } from "./helpers/error-body";
import {
  insertInstanceRole,
  insertUser,
  signInWithRole,
} from "./helpers/admin/instance-roles";
import { resetTestDatabase } from "./helpers/database";

// Every instance permission a custom role can hold.
const CUSTOM_PERMISSIONS = [
  "users:read",
  "users:create",
  "users:update",
  "users:disable",
  "users:delete",
  "users:credentials",
  "users:sessions",
  "users:api_keys",
  "workspaces:read",
  "workspaces:manage",
  "workspaces:archive",
  "workspaces:delete",
  "audit:read",
  "system:read",
  "instance:settings",
];

type Ids = { userId: string; workspaceId: string; roleId: string };
type Route = {
  permission: string;
  method: string;
  path: (ids: Ids) => string;
  body?: (ids: Ids) => unknown;
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");

const routes: Route[] = [
  { permission: "users:read", method: "GET", path: () => "/users" },
  { permission: "users:read", method: "GET", path: () => "/roles" },
  {
    permission: "users:create",
    method: "POST",
    path: () => "/users",
    body: () => ({ name: "New", email: `${randomUUID()}@example.com` }),
  },
  {
    permission: "users:update",
    method: "PATCH",
    path: (ids) => `/users/${ids.userId}`,
    body: () => ({ name: "Renamed" }),
  },
  {
    permission: "users:update",
    method: "PUT",
    path: (ids) => `/users/${ids.userId}/avatar`,
    body: () => ({ contentType: "image/png", data: PNG }),
  },
  {
    permission: "users:update",
    method: "DELETE",
    path: (ids) => `/users/${ids.userId}/avatar`,
  },
  {
    permission: "users:disable",
    method: "POST",
    path: (ids) => `/users/${ids.userId}/deactivate`,
  },
  {
    permission: "users:disable",
    method: "POST",
    path: (ids) => `/users/${ids.userId}/reactivate`,
  },
  {
    permission: "users:delete",
    method: "DELETE",
    path: (ids) => `/users/${ids.userId}`,
  },
  {
    permission: "users:credentials",
    method: "POST",
    path: (ids) => `/users/${ids.userId}/password-reset-email`,
  },
  {
    permission: "users:credentials",
    method: "POST",
    path: (ids) => `/users/${ids.userId}/verification-email`,
  },
  {
    permission: "users:credentials",
    method: "PUT",
    path: (ids) => `/users/${ids.userId}/email-verified`,
  },
  {
    permission: "users:sessions",
    method: "GET",
    path: (ids) => `/users/${ids.userId}/sessions`,
  },
  {
    permission: "users:sessions",
    method: "DELETE",
    path: (ids) => `/users/${ids.userId}/sessions`,
  },
  {
    permission: "users:sessions",
    method: "DELETE",
    path: (ids) => `/users/${ids.userId}/sessions/missing`,
  },
  {
    permission: "users:api_keys",
    method: "GET",
    path: (ids) => `/users/${ids.userId}/api-keys`,
  },
  {
    permission: "users:api_keys",
    method: "DELETE",
    path: (ids) => `/users/${ids.userId}/api-keys/missing`,
  },
  { permission: "workspaces:read", method: "GET", path: () => "/workspaces" },
  {
    permission: "workspaces:read",
    method: "GET",
    path: (ids) => `/workspaces/${ids.workspaceId}/members`,
  },
  {
    permission: "workspaces:read",
    method: "GET",
    path: (ids) => `/workspaces/${ids.workspaceId}/roles`,
  },
  {
    permission: "workspaces:manage",
    method: "POST",
    path: (ids) => `/workspaces/${ids.workspaceId}/members`,
    body: (ids) => ({ userId: ids.userId, role: "member" }),
  },
  {
    permission: "workspaces:manage",
    method: "PUT",
    path: (ids) => `/workspaces/${ids.workspaceId}/members/${ids.userId}/role`,
    body: () => ({ role: "viewer" }),
  },
  {
    permission: "workspaces:manage",
    method: "DELETE",
    path: (ids) => `/workspaces/${ids.workspaceId}/members/${ids.userId}`,
  },
  {
    permission: "workspaces:manage",
    method: "PUT",
    path: (ids) => `/workspaces/${ids.workspaceId}/owner`,
    body: (ids) => ({ userId: ids.userId }),
  },
  {
    permission: "workspaces:archive",
    method: "POST",
    path: (ids) => `/workspaces/${ids.workspaceId}/archive`,
  },
  {
    permission: "workspaces:archive",
    method: "POST",
    path: (ids) => `/workspaces/${ids.workspaceId}/restore`,
  },
  {
    permission: "workspaces:delete",
    method: "DELETE",
    path: (ids) => `/workspaces/${ids.workspaceId}`,
  },
  { permission: "audit:read", method: "GET", path: () => "/audit-log" },
  { permission: "system:read", method: "GET", path: () => "/system" },
  {
    permission: "system:read",
    method: "POST",
    path: () => "/system/test-email",
  },
  {
    permission: "roles:manage",
    method: "POST",
    path: () => "/roles",
    body: () => ({ name: `r${randomUUID().slice(0, 8)}`, permissions: [] }),
  },
  {
    permission: "roles:manage",
    method: "PUT",
    path: (ids) => `/roles/${ids.roleId}`,
    body: () => ({ name: "target-role", permissions: ["audit:read"] }),
  },
  {
    permission: "roles:manage",
    method: "DELETE",
    path: (ids) => `/roles/${ids.roleId}`,
  },
];

async function setUp() {
  const { app } = createApp();
  const target = await insertUser();
  const workspaceId = `workspace-${randomUUID()}`;
  await db.insert(schema.workspaceTable).values({
    id: workspaceId,
    name: "Permission test",
    createdAt: new Date(),
    slug: workspaceId,
  });
  const targetRole = await insertInstanceRole("target-role", []);
  return {
    app,
    ids: { userId: target.id, workspaceId, roleId: targetRole.id },
  };
}

beforeEach(resetTestDatabase);

describe("instance permissions on admin routes", () => {
  it("covers every custom role permission", () => {
    const covered = new Set(routes.map((route) => route.permission));
    for (const permission of CUSTOM_PERMISSIONS) {
      if (permission === "instance:settings") continue; // No route uses it yet.
      expect(covered, permission).toContain(permission);
    }
  });

  it.each(
    routes.map(
      (route) =>
        [
          `${route.method} ${route.path({ userId: ":userId", workspaceId: ":workspaceId", roleId: ":roleId" })}`,
          route,
        ] as const,
    ),
  )("%s needs its permission", async (_name, route) => {
    const { app, ids } = await setUp();
    const others = CUSTOM_PERMISSIONS.filter((p) => p !== route.permission);
    await insertInstanceRole("lacks", others);
    const lacking = await signInWithRole(app, "lacks");

    const denied = await lacking.api(route.path(ids), {
      method: route.method,
      body: route.body?.(ids),
    });
    expect(denied.status).toBe(403);
    expect(await readErrorBody(denied)).toMatchObject({
      code: "INSTANCE_PERMISSION_REQUIRED",
    });

    // roles:manage is only granted by the built-in admin role.
    const holderRole = route.permission === "roles:manage" ? "admin" : "holds";
    if (holderRole === "holds") {
      await insertInstanceRole("holds", [route.permission]);
    }
    const holder = await signInWithRole(app, holderRole);
    const allowed = await holder.api(route.path(ids), {
      method: route.method,
      body: route.body?.(ids),
    });
    expect(allowed.status, await allowed.clone().text()).not.toBe(403);
    expect([500, 502]).not.toContain(allowed.status);
  });
});
