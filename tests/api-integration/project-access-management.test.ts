import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";
import {
  addWorkspaceMember,
  createRestrictedWorkspace,
  restrictToProjects,
} from "./helpers/project-access";

beforeEach(resetTestDatabase);

const origin = "http://localhost:5173";

function client(headers: Record<string, string> = {}) {
  const { app } = createApp();
  return (path: string, init: { method?: string; body?: unknown } = {}) =>
    app.request(`/api${path}`, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", origin, ...headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
}

function setAccess(
  request: ReturnType<typeof client>,
  workspaceId: string,
  userId: string,
  body: { projectAccess: string; projectIds?: string[] },
) {
  return request(`/workspace/${workspaceId}/members/${userId}/project-access`, {
    method: "PUT",
    body,
  });
}

async function accessRows(workspaceId: string, userId: string) {
  const rules = await db
    .select()
    .from(schema.workspaceMemberAccessTable)
    .where(
      and(
        eq(schema.workspaceMemberAccessTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberAccessTable.userId, userId),
      ),
    );
  const grants = await db
    .select()
    .from(schema.workspaceMemberProjectTable)
    .where(
      and(
        eq(schema.workspaceMemberProjectTable.workspaceId, workspaceId),
        eq(schema.workspaceMemberProjectTable.userId, userId),
      ),
    );
  return { rules, grants };
}

describe("managing member project access", () => {
  it("restricts a member and lifts the restriction again", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    mockAuthenticatedSession(ctx.owner);
    const request = client();

    const restricted = await setAccess(request, ctx.workspace.id, member.id, {
      projectAccess: "selected",
      projectIds: [ctx.beta.id],
    });
    expect(restricted.status).toBe(200);
    expect(await restricted.json()).toEqual({
      userId: member.id,
      projectAccess: "selected",
      projectIds: [ctx.beta.id],
    });

    const listed = await request(
      `/workspace/${ctx.workspace.id}/project-access`,
    );
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual(
      expect.arrayContaining([
        {
          userId: member.id,
          projectAccess: "selected",
          projectIds: [ctx.beta.id],
        },
        {
          userId: ctx.restricted.id,
          projectAccess: "selected",
          projectIds: [ctx.alpha.id],
        },
      ]),
    );

    mockAuthenticatedSession(member);
    expect((await client()(`/project/${ctx.alpha.id}`)).status).toBe(403);
    expect((await client()(`/project/${ctx.beta.id}`)).status).toBe(200);

    mockAuthenticatedSession(ctx.owner);
    const lifted = await setAccess(client(), ctx.workspace.id, member.id, {
      projectAccess: "all",
    });
    expect(lifted.status).toBe(200);
    expect(await accessRows(ctx.workspace.id, member.id)).toEqual({
      rules: [],
      grants: [],
    });

    mockAuthenticatedSession(member);
    expect((await client()(`/project/${ctx.alpha.id}`)).status).toBe(200);
  });

  it("refuses to restrict owners or yourself", async () => {
    const ctx = await createRestrictedWorkspace();
    const admin = await addWorkspaceMember(ctx.workspace.id, "admin");
    mockAuthenticatedSession(admin);
    const request = client();

    const owner = await setAccess(request, ctx.workspace.id, ctx.owner.id, {
      projectAccess: "selected",
      projectIds: [ctx.alpha.id],
    });
    expect(owner.status).toBe(400);

    const self = await setAccess(request, ctx.workspace.id, admin.id, {
      projectAccess: "selected",
      projectIds: [ctx.alpha.id],
    });
    expect(self.status).toBe(403);
  });

  it("requires permission to manage members", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    mockAuthenticatedSession(member);
    const request = client();

    expect(
      (await request(`/workspace/${ctx.workspace.id}/project-access`)).status,
    ).toBe(403);
    expect(
      (
        await setAccess(request, ctx.workspace.id, ctx.restricted.id, {
          projectAccess: "all",
        })
      ).status,
    ).toBe(403);
  });

  it("stops a restricted admin from granting more than they can see", async () => {
    const ctx = await createRestrictedWorkspace();
    const admin = await addWorkspaceMember(ctx.workspace.id, "admin");
    await restrictToProjects(ctx.workspace.id, admin.id, [ctx.alpha.id]);
    const unrestricted = await addWorkspaceMember(ctx.workspace.id);
    const member = await addWorkspaceMember(ctx.workspace.id);
    await restrictToProjects(ctx.workspace.id, member.id, [ctx.beta.id]);
    mockAuthenticatedSession(admin);
    const request = client();

    const hidden = await setAccess(request, ctx.workspace.id, member.id, {
      projectAccess: "selected",
      projectIds: [ctx.beta.id],
    });
    expect(hidden.status).toBe(403);

    const everything = await setAccess(request, ctx.workspace.id, member.id, {
      projectAccess: "all",
    });
    expect(everything.status).toBe(403);

    const narrowed = await setAccess(
      request,
      ctx.workspace.id,
      unrestricted.id,
      { projectAccess: "selected", projectIds: [ctx.alpha.id] },
    );
    expect(narrowed.status).toBe(403);

    const visible = await setAccess(request, ctx.workspace.id, member.id, {
      projectAccess: "selected",
      projectIds: [ctx.alpha.id],
    });
    expect(visible.status).toBe(200);
    expect(
      ((await visible.json()) as { projectIds: string[] }).projectIds.sort(),
    ).toEqual([ctx.alpha.id, ctx.beta.id].sort());
  });

  it("rejects projects from another workspace", async () => {
    const ctx = await createRestrictedWorkspace();
    const other = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.owner);

    const response = await setAccess(
      client(),
      ctx.workspace.id,
      ctx.restricted.id,
      { projectAccess: "selected", projectIds: [other.alpha.id] },
    );

    expect(response.status).toBe(400);
  });
});

describe("invitations with project access", () => {
  async function workspaceWithInvitee() {
    const { app } = createApp();
    const owner = await signUpWithSession(app, {
      email: "owner@example.com",
      name: "Owner",
    });
    const ownerRequest = client({ cookie: owner.cookies });
    const created = await ownerRequest("/auth/organization/create", {
      method: "POST",
      body: { name: "Agency", slug: "agency" },
    });
    expect(created.status).toBe(200);
    const workspace = (await created.json()) as { id: string };
    const alpha = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Alpha",
      slug: "alpha",
    });
    const beta = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Beta",
      slug: "beta",
    });
    return {
      app,
      ownerRequest,
      workspaceId: workspace.id,
      alpha: alpha.project,
      beta: beta.project,
    };
  }

  it("applies the invitation's project selection when it's accepted", async () => {
    const ctx = await workspaceWithInvitee();

    const invited = await ctx.ownerRequest("/auth/organization/invite-member", {
      method: "POST",
      body: {
        organizationId: ctx.workspaceId,
        email: "client@example.com",
        role: "member",
        projectAccess: "selected",
        projectIds: [ctx.alpha.id],
      },
    });
    expect(invited.status).toBe(200);
    const invitation = (await invited.json()) as { id: string };
    const [stored] = await db
      .select()
      .from(schema.invitationTable)
      .where(eq(schema.invitationTable.id, invitation.id));
    expect(stored).toMatchObject({
      projectAccess: "selected",
      projectIds: [ctx.alpha.id],
    });

    const invitee = await signUpWithSession(ctx.app, {
      email: "client@example.com",
      name: "Client",
    });
    const inviteeRequest = client({ cookie: invitee.cookies });
    const accepted = await inviteeRequest(
      "/auth/organization/accept-invitation",
      {
        method: "POST",
        body: { invitationId: invitation.id },
      },
    );
    expect(accepted.status).toBe(200);

    const rows = await accessRows(ctx.workspaceId, invitee.userId);
    expect(rows.rules.map((rule) => rule.projectAccess)).toEqual(["selected"]);
    expect(rows.grants.map((grant) => grant.projectId)).toEqual([ctx.alpha.id]);

    const projects = await inviteeRequest(
      `/project?workspaceId=${ctx.workspaceId}`,
    );
    expect(projects.status).toBe(200);
    expect(
      ((await projects.json()) as { id: string }[]).map(
        (project) => project.id,
      ),
    ).toEqual([ctx.alpha.id]);

    const [membership] = await db
      .select({ id: schema.workspaceUserTable.id })
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, invitee.userId));
    const removed = await ctx.ownerRequest("/auth/organization/remove-member", {
      method: "POST",
      body: {
        organizationId: ctx.workspaceId,
        memberIdOrEmail: membership?.id,
      },
    });
    expect(removed.status).toBe(200);
    expect(await accessRows(ctx.workspaceId, invitee.userId)).toEqual({
      rules: [],
      grants: [],
    });
  });

  it("gives every project to an invitation without a selection", async () => {
    const ctx = await workspaceWithInvitee();

    const invited = await ctx.ownerRequest("/auth/organization/invite-member", {
      method: "POST",
      body: {
        organizationId: ctx.workspaceId,
        email: "teammate@example.com",
        role: "member",
      },
    });
    expect(invited.status).toBe(200);
    const invitation = (await invited.json()) as { id: string };

    const invitee = await signUpWithSession(ctx.app, {
      email: "teammate@example.com",
      name: "Teammate",
    });
    const inviteeRequest = client({ cookie: invitee.cookies });
    expect(
      (
        await inviteeRequest("/auth/organization/accept-invitation", {
          method: "POST",
          body: { invitationId: invitation.id },
        })
      ).status,
    ).toBe(200);

    const projects = await inviteeRequest(
      `/project?workspaceId=${ctx.workspaceId}`,
    );
    expect(await projects.json()).toHaveLength(2);
  });

  it("rejects an invitation for projects outside the workspace", async () => {
    const ctx = await workspaceWithInvitee();
    const other = await createRestrictedWorkspace();

    const invited = await ctx.ownerRequest("/auth/organization/invite-member", {
      method: "POST",
      body: {
        organizationId: ctx.workspaceId,
        email: "client@example.com",
        role: "member",
        projectAccess: "selected",
        projectIds: [other.alpha.id],
      },
    });

    expect(invited.status).toBe(400);
    expect(await db.select().from(schema.invitationTable)).toHaveLength(0);
  });
});
