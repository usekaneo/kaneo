import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { checkRegistrationAllowed } from "../../apps/api/src/utils/check-registration-allowed";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

async function seedInvitation(
  email: string,
  overrides?: Partial<{ status: string; expiresAt: Date }>,
) {
  const inviter = await createWorkspaceMember({ role: "owner" });

  const [invitation] = await db
    .insert(schema.invitationTable)
    .values({
      workspaceId: inviter.workspace.id,
      inviterId: inviter.user.id,
      email: email.toLowerCase(),
      role: "member",
      status: overrides?.status ?? "pending",
      expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 86_400_000),
    })
    .returning();

  return invitation;
}

describe("API integration: invite-only registration", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.DISABLE_REGISTRATION = "true";
  });

  afterEach(() => {
    process.env.DISABLE_REGISTRATION = "false";
  });

  it("allows an OAuth signup whose verified email has a pending invitation", async () => {
    const email = `invited-${randomUUID()}@example.com`;
    const invitation = await seedInvitation(email);

    const result = await checkRegistrationAllowed(email, undefined, {
      allowInvitationByEmail: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.invitation?.id).toBe(invitation.id);
  });

  it("matches the invitation regardless of email casing", async () => {
    const email = `invited-${randomUUID()}@example.com`;
    await seedInvitation(email);

    const result = await checkRegistrationAllowed(
      email.toUpperCase(),
      undefined,
      { allowInvitationByEmail: true },
    );

    expect(result.allowed).toBe(true);
  });

  it("rejects an OAuth signup with no invitation for that email", async () => {
    await seedInvitation(`invited-${randomUUID()}@example.com`);

    const result = await checkRegistrationAllowed(
      `stranger-${randomUUID()}@example.com`,
      undefined,
      { allowInvitationByEmail: true },
    );

    expect(result.allowed).toBe(false);
  });

  it.each([
    ["expired", { expiresAt: new Date(Date.now() - 86_400_000) }],
    ["already accepted", { status: "accepted" }],
    ["canceled", { status: "canceled" }],
  ])(
    "rejects an OAuth signup when the invitation is %s",
    async (_label, overrides) => {
      const email = `invited-${randomUUID()}@example.com`;
      await seedInvitation(email, overrides);

      const result = await checkRegistrationAllowed(email, undefined, {
        allowInvitationByEmail: true,
      });

      expect(result.allowed).toBe(false);
    },
  );

  it("still requires the invitation link on the password signup path", async () => {
    const email = `invited-${randomUUID()}@example.com`;
    await seedInvitation(email);

    const result = await checkRegistrationAllowed(email);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("valid invitation link");
  });

  it("keeps rejecting an unknown invitation id", async () => {
    const email = `invited-${randomUUID()}@example.com`;
    await seedInvitation(email);

    const result = await checkRegistrationAllowed(email, "does-not-exist", {
      allowInvitationByEmail: true,
    });

    expect(result.allowed).toBe(false);
  });

  it("allows any signup once registration is open again", async () => {
    process.env.DISABLE_REGISTRATION = "false";

    const result = await checkRegistrationAllowed(
      `anyone-${randomUUID()}@example.com`,
    );

    expect(result.allowed).toBe(true);
  });
});
