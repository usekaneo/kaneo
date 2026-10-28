import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { mockAuthenticatedSession } from "./helpers/auth";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { resetTestDatabase } from "./helpers/database";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { projectAccessApi } from "./helpers/project-access/project-access-api";
import { readMemberAccessRows } from "./helpers/project-access/read-member-access-rows";

beforeEach(resetTestDatabase);

async function roleOf(workspaceId: string, userId: string) {
  const [member] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    );
  return member?.role ?? null;
}

describe("instance admin workspace management", () => {
  it("is limited to instance administrators", async () => {
    const ctx = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.owner);
    const request = projectAccessApi();

    expect((await request("/admin/workspaces")).status).toBe(403);
    expect(
      (
        await request(`/admin/workspaces/${ctx.workspace.id}/owner`, {
          method: "PUT",
          body: { userId: ctx.restricted.id },
        })
      ).status,
    ).toBe(403);
  });

  it("lists every workspace with owners and counts", async () => {
    const ctx = await createRestrictedWorkspace();
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()(
      `/admin/workspaces?search=${encodeURIComponent(ctx.workspace.name)}`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      total: number;
      workspaces: {
        id: string;
        memberCount: number;
        projectCount: number;
        owners: { id: string }[];
      }[];
    };
    expect(body.total).toBe(1);
    expect(body.workspaces[0]).toMatchObject({
      id: ctx.workspace.id,
      memberCount: 2,
      projectCount: 2,
      owners: [{ id: ctx.owner.id }],
    });
  });

  it("transfers ownership to a member and makes the previous owner an admin", async () => {
    const ctx = await createRestrictedWorkspace();
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()(
      `/admin/workspaces/${ctx.workspace.id}/owner`,
      { method: "PUT", body: { userId: ctx.restricted.id } },
    );

    expect(response.status).toBe(200);
    expect(await roleOf(ctx.workspace.id, ctx.restricted.id)).toBe("owner");
    expect(await roleOf(ctx.workspace.id, ctx.owner.id)).toBe("admin");
    expect(
      await readMemberAccessRows(ctx.workspace.id, ctx.restricted.id),
    ).toEqual({ rules: [], grants: [] });

    const again = await projectAccessApi()(
      `/admin/workspaces/${ctx.workspace.id}/owner`,
      { method: "PUT", body: { userId: ctx.restricted.id } },
    );
    expect(again.status).toBe(400);
  });

  it("protects the only owner from role changes and removal", async () => {
    const ctx = await createRestrictedWorkspace();
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();

    const demoted = await request(
      `/admin/workspaces/${ctx.workspace.id}/members/${ctx.owner.id}/role`,
      { method: "PUT", body: { role: "admin" } },
    );
    expect(demoted.status).toBe(409);

    const removed = await request(
      `/admin/workspaces/${ctx.workspace.id}/members/${ctx.owner.id}`,
      { method: "DELETE" },
    );
    expect(removed.status).toBe(409);
    expect(await roleOf(ctx.workspace.id, ctx.owner.id)).toBe("owner");
  });

  it("changes roles to built-in and custom roles but never to owner", async () => {
    const ctx = await createRestrictedWorkspace();
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: ctx.workspace.id,
      role: "reviewer",
      permission: JSON.stringify({ task: ["read"] }),
    });
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();
    const setRole = (role: string) =>
      request(
        `/admin/workspaces/${ctx.workspace.id}/members/${ctx.restricted.id}/role`,
        { method: "PUT", body: { role } },
      );

    expect((await setRole("viewer")).status).toBe(200);
    expect((await setRole("reviewer")).status).toBe(200);
    expect(await roleOf(ctx.workspace.id, ctx.restricted.id)).toBe("reviewer");
    expect((await setRole("owner")).status).toBe(400);
    expect((await setRole("made-up")).status).toBe(400);

    const roles = await request(`/admin/workspaces/${ctx.workspace.id}/roles`);
    expect(await roles.json()).toEqual([
      "viewer",
      "member",
      "admin",
      "reviewer",
    ]);
  });

  it("removes a member and clears their project access", async () => {
    const ctx = await createRestrictedWorkspace();
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()(
      `/admin/workspaces/${ctx.workspace.id}/members/${ctx.restricted.id}`,
      { method: "DELETE" },
    );

    expect(response.status).toBe(200);
    const members = (await response.json()) as { userId: string }[];
    expect(members.map((member) => member.userId)).toEqual([ctx.owner.id]);
    expect(
      await readMemberAccessRows(ctx.workspace.id, ctx.restricted.id),
    ).toEqual({ rules: [], grants: [] });
  });

  it("adds an existing user with every project and rejects duplicates", async () => {
    const ctx = await createRestrictedWorkspace();
    const other = await createRestrictedWorkspace();
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();
    const add = (userId: string, role = "member") =>
      request(`/admin/workspaces/${ctx.workspace.id}/members`, {
        method: "POST",
        body: { userId, role },
      });

    const added = await add(other.owner.id);
    expect(added.status).toBe(200);
    expect(await roleOf(ctx.workspace.id, other.owner.id)).toBe("member");
    expect(
      await readMemberAccessRows(ctx.workspace.id, other.owner.id),
    ).toEqual({ rules: [], grants: [] });

    expect((await add(other.owner.id)).status).toBe(409);
    expect((await add("missing-user")).status).toBe(404);
    expect((await add(other.restricted.id, "owner")).status).toBe(400);
  });

  it("lets an instance admin limit a member's projects without joining", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    const response = await projectAccessApi()(
      `/workspace/${ctx.workspace.id}/members/${member.id}/project-access`,
      {
        method: "PUT",
        body: { projectAccess: "selected", projectIds: [ctx.beta.id] },
      },
    );

    expect(response.status).toBe(200);
    expect(
      (await readMemberAccessRows(ctx.workspace.id, member.id)).grants.map(
        (grant) => grant.projectId,
      ),
    ).toEqual([ctx.beta.id]);
  });
});
