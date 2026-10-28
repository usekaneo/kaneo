import { randomUUID } from "node:crypto";
import * as email from "@kaneo/email";
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
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);
afterEach(() => {
  process.env.DISABLE_REGISTRATION = "false";
});

async function setup(
  role: string,
  permission?: Record<string, string[]>,
  invitationRole = "admin",
) {
  const { app } = createApp();
  const owner = await signUpWithSession(app, {
    email: "owner@example.com",
    name: "Owner",
  });
  const viewer = await signUpWithSession(app, {
    email: "viewer@example.com",
    name: "Viewer",
  });
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({ name: "Team", slug: randomUUID(), createdAt: new Date() })
    .returning();
  await db.insert(schema.workspaceUserTable).values([
    {
      workspaceId: workspace.id,
      userId: owner.userId,
      role: "owner",
      joinedAt: new Date(),
    },
    {
      workspaceId: workspace.id,
      userId: viewer.userId,
      role,
      joinedAt: new Date(),
    },
  ]);
  if (permission) {
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role,
      permission: JSON.stringify(permission),
      createdAt: new Date(),
    });
  }
  const [invitation] = await db
    .insert(schema.invitationTable)
    .values({
      workspaceId: workspace.id,
      inviterId: owner.userId,
      email: "invitee@example.com",
      role: invitationRole,
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  const invitations = async (cookies: string, full: boolean, status = 200) => {
    const path = full ? "get-full-organization" : "list-invitations";
    const response = await app.request(
      `/api/auth/organization/${path}?organizationId=${workspace.id}`,
      { headers: { cookie: cookies } },
    );
    expect(response.status).toBe(status);
    if (status !== 200) return [];
    const body = await response.json();
    return full ? body.invitations : body;
  };
  return { app, owner, viewer, invitation, invitations };
}

describe("workspace invitation visibility", () => {
  it.each(["viewer", "member", "demoted-admin"])(
    "hides invitations from a %s without invitation:create on both endpoints",
    async (role) => {
      const { owner, viewer, invitation, invitations } = await setup(
        role === "demoted-admin" ? "admin" : role,
        role === "demoted-admin" ? {} : undefined,
      );
      for (const full of [false, true]) {
        expect(
          await invitations(
            viewer.cookies,
            full,
            full && role === "demoted-admin" ? 403 : 200,
          ),
        ).toEqual([]);
        expect(await invitations(owner.cookies, full)).toEqual([
          expect.objectContaining({ id: invitation.id }),
        ]);
      }
    },
  );

  it("preserves invitation visibility for a custom inviter role", async () => {
    const { app, viewer, invitation, invitations } = await setup("inviter", {
      invitation: ["create"],
      workspace: ["read"],
    });
    const created = await app.request("/api/auth/organization/invite-member", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: viewer.cookies },
      body: JSON.stringify({
        organizationId: invitation.workspaceId,
        email: "another-admin@example.com",
        role: "admin",
      }),
    });
    expect(created.status).toBe(200);
    const resend = await app.request("/api/auth/organization/invite-member", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: viewer.cookies },
      body: JSON.stringify({
        organizationId: invitation.workspaceId,
        email: "another-admin@example.com",
        role: "admin",
        resend: true,
      }),
    });
    expect(resend.status).toBe(200);
    for (const full of [false, true]) {
      expect(await invitations(viewer.cookies, full)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: invitation.id }),
        ]),
      );
    }
  });

  it.each(["owner", "member,owner"])(
    "hides %s invitation credentials from a custom inviter who cannot assign owner",
    async (role) => {
      const { app, owner, viewer, invitation, invitations } = await setup(
        "inviter",
        { invitation: ["create"], workspace: ["read"] },
        role,
      );
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
      const created = await app.request(
        "/api/auth/organization/invite-member",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: viewer.cookies,
          },
          body: JSON.stringify({
            organizationId: invitation.workspaceId,
            email: "another-owner@example.com",
            role,
          }),
        },
      );
      expect(created.status).toBe(403);
      const resend = await app.request("/api/auth/organization/invite-member", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: viewer.cookies },
        body: JSON.stringify({
          organizationId: invitation.workspaceId,
          email: invitation.email,
          role: "member",
          resend: true,
        }),
      });
      expect(resend.status).toBe(403);
      expect(await resend.text()).not.toContain(invitation.id);
      expect(send).not.toHaveBeenCalled();
      expect(
        await db.query.invitationTable.findFirst({
          where: eq(schema.invitationTable.id, invitation.id),
        }),
      ).toMatchObject({ expiresAt: invitation.expiresAt });
      for (const full of [false, true]) {
        expect(await invitations(viewer.cookies, full)).toEqual([]);
        expect(await invitations(owner.cookies, full)).toEqual([
          expect.objectContaining({ id: invitation.id }),
        ]);
      }
      const ownerResend = await app.request(
        "/api/auth/organization/invite-member",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: owner.cookies,
          },
          body: JSON.stringify({
            organizationId: invitation.workspaceId,
            email: invitation.email,
            role,
            resend: true,
          }),
        },
      );
      expect(ownerResend.status).toBe(200);
      expect(await ownerResend.json()).toMatchObject({ id: invitation.id });
    },
  );

  it.each([
    { bearer: false, role: "owner" },
    { bearer: false, role: "member,owner" },
    { bearer: true, role: "owner" },
    { bearer: true, role: "member,owner" },
  ])(
    "blocks $role resends with an empty workspace ID and an active workspace (bearer=$bearer)",
    async ({ bearer, role }) => {
      const { app, viewer, invitation } = await setup(
        "inviter",
        { invitation: ["create"], workspace: ["read"] },
        role,
      );
      await db
        .update(schema.sessionTable)
        .set({ activeOrganizationId: invitation.workspaceId })
        .where(eq(schema.sessionTable.userId, viewer.userId));
      const session = await auth.api.getSession({
        headers: new Headers({ cookie: viewer.cookies }),
      });
      expect(session).toBeTruthy();
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
      const response = await app.request(
        "/api/auth/organization/invite-member",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(bearer
              ? { authorization: `Bearer ${session!.session.token}` }
              : { cookie: viewer.cookies }),
          },
          body: JSON.stringify({
            organizationId: "",
            email: invitation.email,
            role: "member",
            resend: true,
          }),
        },
      );
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain(invitation.id);
      expect(send).not.toHaveBeenCalled();
      expect(
        await db.query.invitationTable.findFirst({
          where: eq(schema.invitationTable.id, invitation.id),
        }),
      ).toMatchObject({ expiresAt: invitation.expiresAt });
    },
  );

  it.each([false, true])(
    "keeps link-based onboarding available without email delivery (invite-only=%s)",
    async (inviteOnly) => {
      const { app, invitation } = await setup("viewer");
      process.env.DISABLE_REGISTRATION = String(inviteOnly);
      const signup = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: invitation.email,
          name: "Invitee",
          password: "correct horse battery staple",
          invitationId: invitation.id,
        }),
      });
      expect(signup.status).toBe(200);
      const { token, user } = (await signup.json()) as {
        token: string;
        user: { emailVerified: boolean };
      };
      expect(user.emailVerified).toBe(false);
      const accepted = await app.request(
        "/api/auth/organization/accept-invitation",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ invitationId: invitation.id }),
        },
      );
      expect(accepted.status).toBe(200);
    },
  );
});
