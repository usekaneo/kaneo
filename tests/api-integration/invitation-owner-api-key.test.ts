import { randomUUID } from "node:crypto";
import * as email from "@kaneo/email";
import { eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  invitationSecurityFixture,
  organizationRequest,
} from "./helpers/invitation-security";

beforeEach(resetTestDatabase);

async function createKey(
  ctx: Awaited<ReturnType<typeof invitationSecurityFixture>>,
  cookies: string,
  permissions: Record<string, string[]> | null,
) {
  const response = await ctx.app.request("/api/auth/api-key/create", {
    method: "POST",
    headers: { cookie: cookies, "content-type": "application/json" },
    body: JSON.stringify({ name: "Invitation authorization" }),
  });
  expect(response.status).toBe(200);
  const key = (await response.json()) as { id: string; key: string };
  await db
    .update(schema.apikeyTable)
    .set({
      rateLimitEnabled: false,
      ...(permissions === null
        ? {}
        : { permissions: JSON.stringify(permissions) }),
    })
    .where(eq(schema.apikeyTable.id, key.id));
  return key;
}

describe("invitation ownership with API keys", () => {
  it.each([false, true])(
    "checks the key owner's current membership despite an owner cookie (bearer=%s)",
    async (bearer) => {
      const ctx = await invitationSecurityFixture("owner");
      const key = await createKey(ctx, ctx.actor.cookies, {
        invitation: ["create"],
      });
      await db
        .update(schema.workspaceUserTable)
        .set({ role: "recruiter" })
        .where(eq(schema.workspaceUserTable.id, ctx.membership.id));
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
      const headers: Record<string, string> = {
        cookie: ctx.owner.cookies,
        ...(bearer
          ? { authorization: `Bearer ${key.key}` }
          : { "x-api-key": key.key }),
      };
      const denied = await organizationRequest(
        ctx.app,
        headers,
        "invite-member",
        {
          organizationId: ctx.workspace.id,
          email: "invitee@example.com",
          role: ["member", " owner"],
        },
      );
      expect(denied.status).toBe(403);
      expect(await db.select().from(schema.invitationTable)).toEqual([]);
      expect(send).not.toHaveBeenCalled();
      const allowed = await organizationRequest(
        ctx.app,
        headers,
        "invite-member",
        {
          organizationId: ctx.workspace.id,
          email: "invitee@example.com",
          role: ["member", " recruiter"],
        },
      );
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toMatchObject({ role: "member,recruiter" });
    },
  );

  it.each([false, true])(
    "enforces invitation scope before owner grants and preserves scoped/legacy owner keys (bearer=%s)",
    async (bearer) => {
      const ctx = await invitationSecurityFixture();
      const key = await createKey(ctx, ctx.owner.cookies, {
        workspace: ["read"],
      });
      const headers: Record<string, string> = bearer
        ? { authorization: `Bearer ${key.key}` }
        : { "x-api-key": key.key };
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");
      const denied = await organizationRequest(
        ctx.app,
        headers,
        "invite-member",
        {
          organizationId: ctx.workspace.id,
          email: "invitee@example.com",
          role: ["member", " owner"],
        },
      );
      expect(denied.status).toBe(403);
      expect(await denied.json()).toMatchObject({ code: "API_KEY_SCOPE" });
      expect(await db.select().from(schema.invitationTable)).toEqual([]);
      expect(send).not.toHaveBeenCalled();
      for (const permissions of [{ invitation: ["create"] }, null]) {
        const allowedKey = await createKey(ctx, ctx.owner.cookies, permissions);
        const response = await organizationRequest(
          ctx.app,
          bearer
            ? { authorization: `Bearer ${allowedKey.key}` }
            : { "x-api-key": allowedKey.key },
          "invite-member",
          {
            organizationId: ctx.workspace.id,
            email: permissions ? "scoped@example.com" : "legacy@example.com",
            role: ["member", " owner"],
          },
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ role: "member,owner" });
      }
    },
  );
});

describe("API key invitation and removal targets", () => {
  const cases = [false, true].flatMap((bearer) =>
    ["admin, owner", "owner"].map((role) => ({ bearer, role })),
  );

  it.each(cases)(
    "does not inherit an active workspace (bearer=$bearer, role=$role)",
    async ({ bearer, role }) => {
      const ctx = await invitationSecurityFixture("owner");
      const keys: Awaited<ReturnType<typeof createKey>>[] = [];
      for (const permissions of [
        { invitation: ["create"], member: ["delete"] },
        null,
      ]) {
        keys.push(await createKey(ctx, ctx.actor.cookies, permissions));
      }
      await db
        .update(schema.workspaceUserTable)
        .set({ role })
        .where(eq(schema.workspaceUserTable.id, ctx.membership.id));
      await db
        .update(schema.sessionTable)
        .set({ activeOrganizationId: ctx.workspace.id })
        .where(
          inArray(schema.sessionTable.userId, [
            ctx.actor.userId,
            ctx.owner.userId,
          ]),
        );
      // A second canonical owner prevents the last-owner check from masking
      // an unauthorized removal if the key ever inherits a browser target.
      const [otherOwner] = await db
        .insert(schema.userTable)
        .values({
          id: randomUUID(),
          email: "other-owner@example.com",
          emailVerified: true,
          name: "Other owner",
        })
        .returning();
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: ctx.workspace.id,
        userId: otherOwner.id,
        role: "owner",
        joinedAt: new Date(),
      });
      const pending = await ctx.pending("member, owner");
      const members = await db
        .select()
        .from(schema.workspaceUserTable)
        .orderBy(schema.workspaceUserTable.id);
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");

      for (const key of keys) {
        const headers = {
          cookie: ctx.owner.cookies,
          ...(bearer
            ? { authorization: `Bearer ${key.key}` }
            : { "x-api-key": key.key }),
        };
        const session = await ctx.app.request("/api/auth/get-session", {
          headers,
        });
        expect(session.status).toBe(200);
        const viewer = await session.json();
        expect(viewer).toMatchObject({
          user: { id: ctx.actor.userId },
          session: { id: key.id },
        });
        expect(viewer.session.activeOrganizationId).toBeUndefined();

        for (const organizationId of [undefined, ""]) {
          const invited = await organizationRequest(
            ctx.app,
            headers,
            "invite-member",
            {
              organizationId,
              email: "invitee@example.com",
              role: "member",
              resend: true,
            },
          );
          expect(invited.status).toBe(400);
          expect(await invited.json()).toMatchObject({
            code: "ORGANIZATION_NOT_FOUND",
          });
          const removed = await organizationRequest(
            ctx.app,
            headers,
            "remove-member",
            { organizationId, memberIdOrEmail: "owner@example.com" },
          );
          expect(removed.status).toBe(400);
          expect(await removed.json()).toMatchObject({
            code: "NO_ACTIVE_ORGANIZATION",
          });
        }

        // With an explicit target, the stored invitation guard runs even for
        // a true owner. A malformed actor is also denied before member removal.
        const invited = await organizationRequest(
          ctx.app,
          headers,
          "invite-member",
          {
            organizationId: ctx.workspace.id,
            email: "invitee@example.com",
            role: "member",
            resend: true,
          },
        );
        expect(invited.status).toBe(403);
        expect(await invited.json()).toMatchObject({
          code: "OWNER_ROLE_REVIEW_REQUIRED",
        });
        if (role !== "owner") {
          const removed = await organizationRequest(
            ctx.app,
            headers,
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
        }
      }
      expect(
        await db.query.invitationTable.findFirst({
          where: eq(schema.invitationTable.id, pending.id),
        }),
      ).toEqual(pending);
      expect(
        await db
          .select()
          .from(schema.workspaceUserTable)
          .orderBy(schema.workspaceUserTable.id),
      ).toEqual(members);
      expect(send).not.toHaveBeenCalled();
    },
  );
});
