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

const ownerRoles = [
  "owner",
  "member,owner",
  "member, owner",
  "member,  owner",
  "owner ,member",
  "member,\towner\n",
  "member,\u00a0owner\u00a0",
  ["member", " owner"],
  ["member, owner"],
] as const;

describe("invitation ownership authorization", () => {
  it.each(["admin", "recruiter"])(
    "denies all owner role shapes before persistence or email for %s",
    async (actorRole) => {
      const ctx = await invitationSecurityFixture(actorRole);
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
      for (const role of ownerRoles) {
        for (const resend of [false, true]) {
          const response = await ctx.invite(ctx.actor.cookies, role, {
            resend,
          });
          expect(response.status, JSON.stringify({ role, resend })).toBe(403);
          expect(await response.json()).toMatchObject({
            code: "YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE",
          });
        }
      }
      expect(await db.select().from(schema.invitationTable)).toEqual([]);
      expect(await db.select().from(schema.workspaceUserTable)).toHaveLength(2);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("checks bearer sessions and the active workspace before provider validation", async () => {
    const ctx = await invitationSecurityFixture();
    await db
      .update(schema.sessionTable)
      .set({ activeOrganizationId: ctx.workspace.id })
      .where(eq(schema.sessionTable.userId, ctx.actor.userId));
    const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
    const response = await organizationRequest(
      ctx.app,
      await ctx.bearer(),
      "invite-member",
      {
        organizationId: "",
        email: "invitee@example.com",
        role: ["member", "\towner "],
      },
    );
    expect(response.status).toBe(403);
    expect(await db.select().from(schema.invitationTable)).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["owner", "member,owner"])(
    "allows a true %s to grant normalized multi-role ownership",
    async (ownerRole) => {
      const ctx = await invitationSecurityFixture();
      await db
        .update(schema.workspaceUserTable)
        .set({ role: ownerRole })
        .where(eq(schema.workspaceUserTable.userId, ctx.owner.userId));
      const created = await ctx.invite(ctx.owner.cookies, [
        "member",
        " owner ",
      ]);
      expect(created.status).toBe(200);
      const invitation = (await created.json()) as { id: string; role: string };
      expect(invitation.role).toBe("member,owner");
      const { response, invitee } = await ctx.accept(invitation.id);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        member: { role: "member,owner" },
      });
      const followup = await ctx.invite(invitee.cookies, "owner", {
        email: "next@example.com",
      });
      expect(followup.status).toBe(200);
    },
  );

  it.each(
    ["member", " member, recruiter ", ["member", " recruiter "]].map(
      (role) => ({ role }),
    ),
  )(
    "preserves regular invitations, multiple roles and selected project access ($role)",
    async ({ role }) => {
      const ctx = await invitationSecurityFixture();
      const created = await ctx.invite(ctx.actor.cookies, role, {
        projectAccess: "selected",
        projectIds: [ctx.project.id],
      });
      expect(created.status).toBe(200);
      const invitation = (await created.json()) as { id: string; role: string };
      const expected = role === "member" ? "member" : "member,recruiter";
      expect(invitation.role).toBe(expected);
      const { response, invitee } = await ctx.accept(invitation.id);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        member: { role: expected },
      });
      const access = await readMemberAccessRows(
        ctx.workspace.id,
        invitee.userId,
      );
      expect(access.rules.map((row) => row.projectAccess)).toEqual([
        "selected",
      ]);
      expect(access.grants.map((row) => row.projectId)).toEqual([
        ctx.project.id,
      ]);
      expect(
        (
          await ctx.app.request(`/api/project/${ctx.project.id}`, {
            method: "DELETE",
            headers: { cookie: invitee.cookies },
          })
        ).status,
      ).toBe(403);
    },
  );

  it("normalizes ownership before enforcing the owner project-access invariant", async () => {
    const ctx = await invitationSecurityFixture();
    const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
    const response = await ctx.invite(
      ctx.owner.cookies,
      ["member", " owner "],
      {
        projectAccess: "selected",
        projectIds: [ctx.project.id],
      },
    );
    expect(response.status).toBe(400);
    expect(await db.select().from(schema.invitationTable)).toEqual([]);
    expect(send).not.toHaveBeenCalled();
  });

  it.each(
    [null, 3, { role: "owner" }, ["member", 3]].map((role) => ({ role })),
  )(
    "retains provider validation for malformed role shapes ($role)",
    async ({ role }) => {
      const ctx = await invitationSecurityFixture();
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
      expect((await ctx.invite(ctx.actor.cookies, role)).status).toBe(400);
      expect(await db.select().from(schema.invitationTable)).toEqual([]);
      expect(send).not.toHaveBeenCalled();
    },
  );
});
