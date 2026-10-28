import { beforeEach, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  defaultRolePayloads,
  WORKSPACE_CAPABILITY_NAMES,
} from "../../packages/permissions/src";
import { resetTestDatabase } from "./helpers/database";

const origin = "http://localhost:5173";
const { app } = createApp();

async function signup(email: string) {
  const result = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", Origin: origin },
    body: JSON.stringify({
      name: "Capabilities test",
      email,
      password: "long-password-for-tests",
    }),
  });
  expect(result.status).toBe(200);
  const body = await result.json();
  const cookie = result.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return { id: body.user.id as string, cookie };
}

function getCapabilities(workspaceId: string, cookie: string) {
  return app.request(`/api/workspace/${workspaceId}/capabilities`, {
    headers: { Origin: origin, Cookie: cookie },
  });
}

async function seedWorkspace() {
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: "capabilities-workspace",
      name: "Workspace",
      slug: "capabilities",
      createdAt: new Date(),
    })
    .returning();
  await db.insert(schema.workspaceRoleTable).values([
    {
      workspaceId: workspace.id,
      role: "viewer",
      permission: JSON.stringify(defaultRolePayloads.viewer),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      workspaceId: workspace.id,
      role: "triage",
      permission: JSON.stringify({
        workspace: ["read"],
        project: ["read"],
        task: ["read", "create", "update"],
      }),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);
  return workspace;
}

beforeEach(() => resetTestDatabase());

it("reports every capability for the caller's role in one response", async () => {
  const owner = await signup("owner@example.com");
  const viewer = await signup("viewer@example.com");
  const triage = await signup("triage@example.com");
  const workspace = await seedWorkspace();
  await db.insert(schema.workspaceUserTable).values([
    {
      workspaceId: workspace.id,
      userId: owner.id,
      role: "owner",
      joinedAt: new Date(),
    },
    {
      workspaceId: workspace.id,
      userId: viewer.id,
      role: "viewer",
      joinedAt: new Date(),
    },
    {
      workspaceId: workspace.id,
      userId: triage.id,
      role: "triage",
      joinedAt: new Date(),
    },
  ]);

  const ownerResponse = await getCapabilities(workspace.id, owner.cookie);
  expect(ownerResponse.status).toBe(200);
  const ownerCapabilities = await ownerResponse.json();
  expect(Object.keys(ownerCapabilities).sort()).toEqual(
    [...WORKSPACE_CAPABILITY_NAMES].sort(),
  );
  expect(Object.values(ownerCapabilities).every(Boolean)).toBe(true);

  const viewerCapabilities = await (
    await getCapabilities(workspace.id, viewer.cookie)
  ).json();
  expect(viewerCapabilities).toMatchObject({
    createTasks: false,
    updateTasks: false,
    manageWorkspace: false,
    inviteUsers: false,
  });

  // Custom roles resolve from the stored definition, like enforcement does.
  const triageCapabilities = await (
    await getCapabilities(workspace.id, triage.cookie)
  ).json();
  expect(triageCapabilities).toMatchObject({
    createTasks: true,
    updateTasks: true,
    deleteTasks: false,
    createProjects: false,
  });
});

it("does not reveal capabilities in a workspace the caller isn't in", async () => {
  // The first account on an instance becomes its admin, so sign one up before
  // the outsider to keep the outsider an ordinary user.
  const owner = await signup("owner@example.com");
  const outsider = await signup("outsider@example.com");
  const workspace = await seedWorkspace();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: workspace.id,
    userId: owner.id,
    role: "owner",
    joinedAt: new Date(),
  });

  const response = await getCapabilities(workspace.id, outsider.cookie);
  expect(response.status).toBe(404);
});
