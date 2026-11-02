import * as email from "@kaneo/email";
import { eq } from "drizzle-orm";
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
