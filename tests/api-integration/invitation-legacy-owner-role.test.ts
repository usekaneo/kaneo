import * as email from "@kaneo/email";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  invitationSecurityFixture,
  organizationRequest,
} from "./helpers/invitation-security";
import { readMemberAccessRows } from "./helpers/project-access/read-member-access-rows";

beforeEach(resetTestDatabase);

describe("legacy invitation ownership", () => {
  it.each(["member, owner", "owner ,member", "member,\towner\n"])(
    "refuses pending %j before acceptance or project access writes",
    async (role) => {
      const ctx = await invitationSecurityFixture();
      const invitation = await ctx.pending(role);
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
      const { response, invitee } = await ctx.accept(invitation.id);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        code: "OWNER_ROLE_REVIEW_REQUIRED",
      });
      expect(
        await db.query.invitationTable.findFirst({
          where: eq(schema.invitationTable.id, invitation.id),
        }),
      ).toEqual(invitation);
      expect(
        await db.query.workspaceUserTable.findFirst({
          where: eq(schema.workspaceUserTable.userId, invitee.userId),
        }),
      ).toBeUndefined();
      expect(
        await readMemberAccessRows(ctx.workspace.id, invitee.userId),
      ).toEqual({ rules: [], grants: [] });
      expect(send).not.toHaveBeenCalled();
    },
  );

  it.each(["owner", "member,owner"])(
    "still accepts a previously authorized canonical %s invitation",
    async (role) => {
      const ctx = await invitationSecurityFixture();
      const invitation = await ctx.pending(role);
      const { response, invitee } = await ctx.accept(invitation.id);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ member: { role } });
      expect(
        await readMemberAccessRows(ctx.workspace.id, invitee.userId),
      ).toEqual({ rules: [], grants: [] });
    },
  );

  it("denies legacy owner resends before expiry changes or email, including for owners", async () => {
    const ctx = await invitationSecurityFixture();
    const invitation = await ctx.pending("member, owner");
    const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
    for (const cookies of [ctx.actor.cookies, ctx.owner.cookies]) {
      const response = await ctx.invite(cookies, "member", { resend: true });
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain(invitation.id);
      expect(
        await db.query.invitationTable.findFirst({
          where: eq(schema.invitationTable.id, invitation.id),
        }),
      ).toEqual(invitation);
    }
    const listed = await ctx.app.request(
      `/api/auth/organization/list-invitations?organizationId=${ctx.workspace.id}`,
      { headers: { cookie: ctx.actor.cookies } },
    );
    expect(listed.status).toBe(200);
    expect(await listed.json()).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["member", "owner"])(
    "lets an owner replace an expired ambiguous invitation with %s",
    async (role) => {
      const ctx = await invitationSecurityFixture();
      const expired = await ctx.pending("member, owner");
      await db
        .update(schema.invitationTable)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(schema.invitationTable.id, expired.id));
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
      const response = await ctx.invite(ctx.owner.cookies, role, {
        resend: true,
      });
      expect(response.status).toBe(200);
      const created = (await response.json()) as { id: string; role: string };
      expect(created.id).not.toBe(expired.id);
      expect(created.role).toBe(role);
      expect(send).toHaveBeenCalledOnce();
    },
  );

  it("rejects owner requests even when a resend would retain an ordinary stored role", async () => {
    const ctx = await invitationSecurityFixture();
    const invitation = await ctx.pending("member");
    const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
    const response = await ctx.invite(ctx.actor.cookies, ["member", " owner"], {
      resend: true,
    });
    expect(response.status).toBe(403);
    expect(
      await db.query.invitationTable.findFirst({
        where: eq(schema.invitationTable.id, invitation.id),
      }),
    ).toEqual(invitation);
    expect(send).not.toHaveBeenCalled();
  });

  it("preserves ordinary resends, stored roles and project selections", async () => {
    const ctx = await invitationSecurityFixture();
    const invitation = await ctx.pending("member,recruiter");
    const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
    const response = await ctx.invite(ctx.actor.cookies, "member", {
      resend: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: invitation.id,
      role: "member,recruiter",
      projectAccess: "selected",
      projectIds: [ctx.project.id],
    });
    expect(send).toHaveBeenCalledOnce();
  });
});

describe("previously accepted ambiguous ownership", () => {
  it.each(["member, owner", "recruiter, owner", "admin, owner"])(
    "removes only the accidental ownership of %j without rewriting membership",
    async (role) => {
      const ctx = await invitationSecurityFixture(role);
      const capabilities = await ctx.app.request(
        `/api/workspace/${ctx.workspace.id}/capabilities`,
        {
          headers: { cookie: ctx.actor.cookies },
        },
      );
      expect(capabilities.status).toBe(200);
      expect(await capabilities.json()).toMatchObject({
        deleteWorkspace: false,
        inviteUsers: role !== "member, owner",
        deleteProjects: role === "admin, owner",
      });
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
      const invited = await ctx.invite(ctx.actor.cookies, "owner");
      expect(invited.status).toBe(403);
      expect(await invited.json()).toMatchObject({
        code: "OWNER_ROLE_REVIEW_REQUIRED",
      });
      const promoted = await organizationRequest(
        ctx.app,
        { cookie: ctx.actor.cookies },
        "update-member-role",
        {
          organizationId: ctx.workspace.id,
          memberId: ctx.membership.id,
          role: ["member", " owner"],
        },
      );
      expect(promoted.status).toBe(403);
      // A second canonical owner makes the provider's last-owner check pass;
      // the malformed actor must still never acquire the right to remove one.
      const secondOwner = await ctx.accept((await ctx.pending("owner")).id);
      expect(secondOwner.response.status).toBe(200);
      const removed = await organizationRequest(
        ctx.app,
        { cookie: ctx.actor.cookies },
        "remove-member",
        {
          organizationId: ctx.workspace.id,
          memberIdOrEmail: "owner@example.com",
        },
      );
      expect(removed.status).toBe(403);
      expect(await removed.json()).toMatchObject({
        code: "OWNER_ROLE_REVIEW_REQUIRED",
      });
      expect(
        await db.query.workspaceUserTable.findFirst({
          where: eq(schema.workspaceUserTable.id, ctx.membership.id),
        }),
      ).toEqual(ctx.membership);
      expect(
        await db.query.workspaceUserTable.findFirst({
          where: eq(schema.workspaceUserTable.userId, ctx.owner.userId),
        }),
      ).toBeDefined();
      expect(send).not.toHaveBeenCalled();
      // Only an explicit decision by a true owner can restore ownership.
      const reviewed = await organizationRequest(
        ctx.app,
        { cookie: ctx.owner.cookies },
        "update-member-role",
        {
          organizationId: ctx.workspace.id,
          memberId: ctx.membership.id,
          role: "member,owner",
        },
      );
      expect(reviewed.status).toBe(200);
      expect(
        (
          await ctx.invite(ctx.actor.cookies, "owner", {
            email: "reviewed@example.com",
          })
        ).status,
      ).toBe(200);
    },
  );
});
