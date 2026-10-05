import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
import { projectAccessApi } from "./helpers/project-access/project-access-api";
import { putMemberProjectAccess } from "./helpers/project-access/put-member-project-access";
import { readMemberAccessRows } from "./helpers/project-access/read-member-access-rows";
import { createInvitationWorkspace } from "./helpers/project-access/create-invitation-workspace";

beforeEach(resetTestDatabase);

describe("managing member project access", () => {
  it("restricts a member and lifts the restriction again", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    mockAuthenticatedSession(ctx.owner);
    const request = projectAccessApi();

    const restricted = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      member.id,
      {
        projectAccess: "selected",
        projectIds: [ctx.beta.id],
      },
    );
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
    expect((await projectAccessApi()(`/project/${ctx.alpha.id}`)).status).toBe(
      403,
    );
    expect((await projectAccessApi()(`/project/${ctx.beta.id}`)).status).toBe(
      200,
    );

    mockAuthenticatedSession(ctx.owner);
    const lifted = await putMemberProjectAccess(
      projectAccessApi(),
      ctx.workspace.id,
      member.id,
      {
        projectAccess: "all",
      },
    );
    expect(lifted.status).toBe(200);
    expect(await readMemberAccessRows(ctx.workspace.id, member.id)).toEqual({
      rules: [],
      grants: [],
    });

    mockAuthenticatedSession(member);
    expect((await projectAccessApi()(`/project/${ctx.alpha.id}`)).status).toBe(
      200,
    );
  });

  it("refuses to restrict owners or yourself", async () => {
    const ctx = await createRestrictedWorkspace();
    const admin = await addWorkspaceMember(ctx.workspace.id, "admin");
    mockAuthenticatedSession(admin);
    const request = projectAccessApi();

    const owner = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      ctx.owner.id,
      {
        projectAccess: "selected",
        projectIds: [ctx.alpha.id],
      },
    );
    expect(owner.status).toBe(400);

    const self = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      admin.id,
      {
        projectAccess: "selected",
        projectIds: [ctx.alpha.id],
      },
    );
    expect(self.status).toBe(403);
  });

  it("requires permission to manage members", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    mockAuthenticatedSession(member);
    const request = projectAccessApi();

    expect(
      (await request(`/workspace/${ctx.workspace.id}/project-access`)).status,
    ).toBe(403);
    expect(
      (
        await putMemberProjectAccess(
          request,
          ctx.workspace.id,
          ctx.restricted.id,
          {
            projectAccess: "all",
          },
        )
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
    const request = projectAccessApi();

    const hidden = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      member.id,
      {
        projectAccess: "selected",
        projectIds: [ctx.beta.id],
      },
    );
    expect(hidden.status).toBe(403);

    const everything = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      member.id,
      {
        projectAccess: "all",
      },
    );
    expect(everything.status).toBe(403);

    const narrowed = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      unrestricted.id,
      { projectAccess: "selected", projectIds: [ctx.alpha.id] },
    );
    expect(narrowed.status).toBe(403);

    const visible = await putMemberProjectAccess(
      request,
      ctx.workspace.id,
      member.id,
      {
        projectAccess: "selected",
        projectIds: [ctx.alpha.id],
      },
    );
    expect(visible.status).toBe(200);
    expect(
      ((await visible.json()) as { projectIds: string[] }).projectIds.sort(),
    ).toEqual([ctx.alpha.id, ctx.beta.id].sort());
  });

  it("rejects projects from another workspace", async () => {
    const ctx = await createRestrictedWorkspace();
    const other = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.owner);

    const response = await putMemberProjectAccess(
      projectAccessApi(),
      ctx.workspace.id,
      ctx.restricted.id,
      { projectAccess: "selected", projectIds: [other.alpha.id] },
    );

    expect(response.status).toBe(400);
  });
});

describe("invitations with project access", () => {
  it("applies the invitation's project selection when it's accepted", async () => {
    const ctx = await createInvitationWorkspace();

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
    const inviteeRequest = projectAccessApi({ cookie: invitee.cookies });
    const accepted = await inviteeRequest(
      "/auth/organization/accept-invitation",
      {
        method: "POST",
        body: { invitationId: invitation.id },
      },
    );
    expect(accepted.status).toBe(200);

    const rows = await readMemberAccessRows(ctx.workspaceId, invitee.userId);
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
    expect(await readMemberAccessRows(ctx.workspaceId, invitee.userId)).toEqual(
      {
        rules: [],
        grants: [],
      },
    );
  });

  it("gives every project to an invitation without a selection", async () => {
    const ctx = await createInvitationWorkspace();

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
    const inviteeRequest = projectAccessApi({ cookie: invitee.cookies });
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
    const ctx = await createInvitationWorkspace();
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
