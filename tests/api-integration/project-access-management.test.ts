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

  it("tells each member their own project access", async () => {
    const ctx = await createRestrictedWorkspace();

    mockAuthenticatedSession(ctx.restricted);
    const restricted = await projectAccessApi()(
      `/workspace/${ctx.workspace.id}/project-access/me`,
    );
    expect(restricted.status).toBe(200);
    expect(await restricted.json()).toEqual({
      userId: ctx.restricted.id,
      projectAccess: "selected",
      projectIds: [ctx.alpha.id],
    });

    mockAuthenticatedSession(ctx.owner);
    const owner = await projectAccessApi()(
      `/workspace/${ctx.workspace.id}/project-access/me`,
    );
    expect(await owner.json()).toMatchObject({ projectAccess: "all" });
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
      ((await visible.json()) as { projectIds: string[] }).projectIds,
    ).toEqual([ctx.alpha.id]);
    const stored = await readMemberAccessRows(ctx.workspace.id, member.id);
    expect(stored.grants.map((grant) => grant.projectId).sort()).toEqual(
      [ctx.alpha.id, ctx.beta.id].sort(),
    );

    const listed = await request(
      `/workspace/${ctx.workspace.id}/project-access`,
    );
    expect(listed.status).toBe(200);
    const entries = (await listed.json()) as {
      userId: string;
      projectIds: string[];
    }[];
    expect(JSON.stringify(entries)).not.toContain(ctx.beta.id);
    expect(entries.find((entry) => entry.userId === member.id)).toMatchObject({
      projectIds: [ctx.alpha.id],
    });
  });

  it("unassigns a member from tasks in projects they lose", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    await db
      .update(schema.taskTable)
      .set({ userId: member.id })
      .where(eq(schema.taskTable.id, ctx.betaTask.id));
    mockAuthenticatedSession(ctx.owner);

    const restricted = await putMemberProjectAccess(
      projectAccessApi(),
      ctx.workspace.id,
      member.id,
      { projectAccess: "selected", projectIds: [ctx.alpha.id] },
    );

    expect(restricted.status).toBe(200);
    const [task] = await db
      .select({ userId: schema.taskTable.userId })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, ctx.betaTask.id));
    expect(task?.userId).toBeNull();
    const activities = await db
      .select({ type: schema.activityTable.type })
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, ctx.betaTask.id));
    expect(activities.map((activity) => activity.type)).toContain("unassigned");
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

  it("clears a member's project limit when they become an owner", async () => {
    const ctx = await createInvitationWorkspace();
    const invited = await ctx.ownerRequest("/auth/organization/invite-member", {
      method: "POST",
      body: {
        organizationId: ctx.workspaceId,
        email: "lead@example.com",
        role: "member",
        projectAccess: "selected",
        projectIds: [ctx.alpha.id],
      },
    });
    const invitation = (await invited.json()) as { id: string };
    const invitee = await signUpWithSession(ctx.app, {
      email: "lead@example.com",
      name: "Lead",
    });
    await projectAccessApi({ cookie: invitee.cookies })(
      "/auth/organization/accept-invitation",
      { method: "POST", body: { invitationId: invitation.id } },
    );
    const [membership] = await db
      .select({ id: schema.workspaceUserTable.id })
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, invitee.userId));

    const promoted = await ctx.ownerRequest(
      "/auth/organization/update-member-role",
      {
        method: "POST",
        body: {
          organizationId: ctx.workspaceId,
          memberId: membership?.id,
          role: "owner",
        },
      },
    );

    expect(promoted.status).toBe(200);
    expect(await readMemberAccessRows(ctx.workspaceId, invitee.userId)).toEqual(
      { rules: [], grants: [] },
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

  it("hides invited project ids from a limited admin", async () => {
    const ctx = await createInvitationWorkspace();
    const invite = async (email: string, role: string, projectIds: string[]) =>
      (await (
        await ctx.ownerRequest("/auth/organization/invite-member", {
          method: "POST",
          body: {
            organizationId: ctx.workspaceId,
            email,
            role,
            projectAccess: "selected",
            projectIds,
          },
        })
      ).json()) as { id: string };

    const adminInvitation = await invite("admin@example.com", "admin", [
      ctx.alpha.id,
    ]);
    const admin = await signUpWithSession(ctx.app, {
      email: "admin@example.com",
      name: "Limited Admin",
    });
    const adminRequest = projectAccessApi({ cookie: admin.cookies });
    await adminRequest("/auth/organization/accept-invitation", {
      method: "POST",
      body: { invitationId: adminInvitation.id },
    });
    await invite("client@example.com", "member", [ctx.alpha.id, ctx.beta.id]);

    const listed = await adminRequest(
      `/auth/organization/list-invitations?organizationId=${ctx.workspaceId}`,
    );
    expect(listed.status).toBe(200);
    const invitations = (await listed.json()) as {
      email: string;
      projectIds: string[];
    }[];
    expect(
      invitations.find(
        (invitation) => invitation.email === "client@example.com",
      )?.projectIds,
    ).toEqual([ctx.alpha.id]);
    expect(JSON.stringify(invitations)).not.toContain(ctx.beta.id);
  });

  it("drops deleted projects from listed invitations", async () => {
    const ctx = await createInvitationWorkspace();
    await ctx.ownerRequest("/auth/organization/invite-member", {
      method: "POST",
      body: {
        organizationId: ctx.workspaceId,
        email: "client@example.com",
        role: "member",
        projectAccess: "selected",
        projectIds: [ctx.alpha.id, ctx.beta.id],
      },
    });
    const deleted = await ctx.ownerRequest(`/project/${ctx.beta.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);

    const listed = await ctx.ownerRequest(
      `/auth/organization/list-invitations?organizationId=${ctx.workspaceId}`,
    );
    const [invitation] = (await listed.json()) as { projectIds: string[] }[];
    expect(invitation?.projectIds).toEqual([ctx.alpha.id]);
  });
});

describe("notification rules with project access", () => {
  it("keeps projects a member lost when they save the rule again", async () => {
    const ctx = await createRestrictedWorkspace();
    const member = await addWorkspaceMember(ctx.workspace.id);
    mockAuthenticatedSession(member);
    const request = projectAccessApi();
    const rule = (projectIds: string[]) =>
      request(`/notification-preferences/workspaces/${ctx.workspace.id}`, {
        method: "PUT",
        body: {
          isActive: true,
          emailEnabled: false,
          ntfyEnabled: false,
          gotifyEnabled: false,
          webhookEnabled: false,
          projectMode: "selected",
          selectedProjectIds: projectIds,
        },
      });

    expect((await rule([ctx.alpha.id, ctx.beta.id])).status).toBe(200);
    await restrictToProjects(ctx.workspace.id, member.id, [ctx.alpha.id]);

    const read = await request("/notification-preferences");
    const preferences = (await read.json()) as {
      workspaces: { selectedProjectIds: string[] }[];
    };
    expect(preferences.workspaces[0]?.selectedProjectIds).toEqual([
      ctx.alpha.id,
    ]);

    expect((await rule([])).status).toBe(200);
    const stored = await db
      .select({
        projectId: schema.userNotificationWorkspaceProjectTable.projectId,
      })
      .from(schema.userNotificationWorkspaceProjectTable);
    expect(stored.map((row) => row.projectId)).toEqual([ctx.beta.id]);
  });
});
