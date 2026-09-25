import * as email from "@kaneo/email";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import getInstanceStatus from "../../apps/api/src/instance/controllers/get-instance-status";
import { promoteInitialAdministrator } from "../../apps/api/src/utils/instance-bootstrap";
import { assertUserRegistrationAllowed } from "../../apps/api/src/utils/registration-policy";
import { drainSignInEmails } from "../../apps/api/src/utils/sign-in-email-tasks";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const headers = {
  "content-type": "application/json",
  Origin: "http://localhost:5173",
};
async function post(
  path: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
  waitForEmail = true,
) {
  const response = await createApp().app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(body),
  });
  if (waitForEmail) await drainSignInEmails();
  return response;
}
function signup(email: string, extraHeaders?: Record<string, string>) {
  return post(
    "/sign-up/email",
    { name: "Test", email, password: "test-password-at-least-12" },
    extraHeaders,
  );
}
async function invitation(email: string) {
  const inviter = await createWorkspaceMember({ role: "owner" });
  const [row] = await db
    .insert(schema.invitationTable)
    .values({
      email,
      workspaceId: inviter.workspace.id,
      inviterId: inviter.user.id,
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
    })
    .returning();
  return row;
}

describe("auth registration and bootstrap boundaries", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects anonymous bootstrap and ignores historical anonymous rows", async () => {
    expect((await post("/sign-in/anonymous", {})).status).toBe(403);
    expect(await db.select().from(schema.userTable)).toHaveLength(0);
    await db.insert(schema.userTable).values({
      id: "old-guest",
      email: "old-guest@example.com",
      name: "Guest",
      isAnonymous: true,
    });
    expect(await getInstanceStatus()).toEqual({
      hasUsers: false,
      hasAdmin: false,
    });
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    expect((await signup("first@example.com")).status).toBe(200);
    expect(await getInstanceStatus()).toEqual({
      hasUsers: true,
      hasAdmin: true,
    });
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.role, "admin")),
    ).toEqual([expect.objectContaining({ email: "first@example.com" })]);
  });

  it.each([
    "DISABLE_REGISTRATION",
    "DISABLE_PASSWORD_REGISTRATION",
    "DISABLE_LOGIN_FORM",
    "DISABLE_GUEST_ACCESS",
  ])("enforces %s on anonymous sign-in", async (flag) => {
    await createWorkspaceMember();
    vi.stubEnv(flag, "true");
    expect((await post("/sign-in/anonymous", {})).status).toBe(403);
    expect(await db.select().from(schema.userTable)).toHaveLength(1);
  });

  it("allows configured guest access on an initialized open instance", async () => {
    await createWorkspaceMember();
    expect((await post("/sign-in/anonymous", {})).status).toBe(200);
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.isAnonymous, true)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.role, "admin")),
    ).toHaveLength(0);
  });

  it("elects exactly one admin when multiple first users already exist before the after-hooks", async () => {
    await db.insert(schema.userTable).values(
      ["first", "second"].map((id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
        createdAt: new Date("2026-01-01"),
      })),
    );
    await Promise.all([
      promoteInitialAdministrator("second"),
      promoteInitialAdministrator("first"),
    ]);
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.role, "admin")),
    ).toEqual([expect.objectContaining({ id: "first" })]);
  });

  it("keeps one admin through concurrent HTTP first signups", async () => {
    const responses = await Promise.all(
      [1, 2, 3, 4].map((n) => signup(`race-${n}@example.com`)),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.role, "admin")),
    ).toHaveLength(1);
  });

  it("does not give a new signup admin rights on an older instance lacking an admin", async () => {
    await createWorkspaceMember();
    expect((await signup("new@example.com")).status).toBe(200);
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.role, "admin")),
    ).toHaveLength(0);
  });

  it("requires the matching invitation secret for password signup", async () => {
    const invite = await invitation("invitee@example.com");
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    expect((await signup(invite.email)).status).toBe(403);
    expect(
      (await signup(invite.email, { "x-invitation-id": "wrong" })).status,
    ).toBe(403);
    expect(
      (await signup("other@example.com", { "x-invitation-id": invite.id }))
        .status,
    ).toBe(403);
    expect(
      (await signup(invite.email, { "x-invitation-id": invite.id })).status,
    ).toBe(200);
  });

  it("only accepts provider or mailbox verified email claims at the user-create boundary", async () => {
    await invitation("invitee@example.com");
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    for (const path of [
      "/callback/github",
      "/oauth2/callback/custom",
      "/sign-in/email-otp",
      "/magic-link/verify",
    ]) {
      await expect(
        assertUserRegistrationAllowed(
          { email: "invitee@example.com", emailVerified: false },
          { path },
        ),
      ).rejects.toMatchObject({ status: "FORBIDDEN" });
      await expect(
        assertUserRegistrationAllowed(
          { email: "invitee@example.com", emailVerified: true },
          { path },
        ),
      ).resolves.toBeUndefined();
    }
    await expect(
      assertUserRegistrationAllowed(
        { email: "invitee@example.com", emailVerified: true },
        { path: "/sign-up/email" },
      ),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
  });

  it("prevents new OTP accounts under the local-registration restriction but preserves existing-user OTP login", async () => {
    const member = await createWorkspaceMember();
    vi.stubEnv("DISABLE_PASSWORD_REGISTRATION", "true");
    const send = vi.spyOn(email, "sendOtpEmail").mockResolvedValue(undefined);
    const sendMagicLink = vi
      .spyOn(email, "sendMagicLinkEmail")
      .mockResolvedValue(undefined);
    for (const address of ["new-otp@example.com", member.user.email]) {
      expect(
        (
          await post("/email-otp/send-verification-otp", {
            email: address,
            type: "sign-in",
          })
        ).status,
      ).toBe(200);
      expect(
        (await post("/sign-in/magic-link", { email: address })).status,
      ).toBe(200);
    }
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.lastCall?.[0]).toBe(member.user.email);
    expect(sendMagicLink).toHaveBeenCalledTimes(1);
    expect(sendMagicLink.mock.lastCall?.[0]).toBe(member.user.email);
    const data = send.mock.lastCall?.[2] as { otp: string } | undefined;
    expect(data?.otp).toBeTruthy();
    const response = await post("/sign-in/email-otp", {
      email: member.user.email,
      otp: data?.otp,
    });
    expect(response.status).toBe(200);
    expect(await db.select().from(schema.userTable)).toHaveLength(1);
  });

  it("still emails the first user's OTP and magic link for initial setup when registration is disabled", async () => {
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    const sendOtp = vi
      .spyOn(email, "sendOtpEmail")
      .mockResolvedValue(undefined);
    const sendMagicLink = vi
      .spyOn(email, "sendMagicLinkEmail")
      .mockResolvedValue(undefined);

    expect(
      (
        await post("/email-otp/send-verification-otp", {
          email: "first@example.com",
          type: "sign-in",
        })
      ).status,
    ).toBe(200);
    expect(
      (await post("/sign-in/magic-link", { email: "first@example.com" }))
        .status,
    ).toBe(200);
    expect(sendOtp.mock.calls.map((call) => call[0])).toEqual([
      "first@example.com",
    ]);
    expect(sendMagicLink.mock.calls.map((call) => call[0])).toEqual([
      "first@example.com",
    ]);

    const data = sendOtp.mock.lastCall?.[2] as { otp: string };
    const response = await post("/sign-in/email-otp", {
      email: "first@example.com",
      otp: data.otp,
    });
    expect(response.status).toBe(200);
    expect(await db.select().from(schema.userTable)).toHaveLength(1);
  });

  it("only emails sign-in OTPs and magic links to existing or invited addresses when registration is disabled", async () => {
    const member = await createWorkspaceMember();
    const invite = await invitation("invitee@example.com");
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    const sendOtp = vi
      .spyOn(email, "sendOtpEmail")
      .mockResolvedValue(undefined);
    const sendMagicLink = vi
      .spyOn(email, "sendMagicLinkEmail")
      .mockResolvedValue(undefined);

    for (const address of [
      member.user.email,
      invite.email,
      "stranger@example.com",
    ]) {
      expect(
        (
          await post("/email-otp/send-verification-otp", {
            email: address,
            type: "sign-in",
          })
        ).status,
      ).toBe(200);
      expect(
        (await post("/sign-in/magic-link", { email: address })).status,
      ).toBe(200);
    }

    const expectedRecipients = [invite.email, member.user.email].sort();
    const recipients = (mock: {
      mock: { calls: [to: string, subject: string, data: unknown][] };
    }) => mock.mock.calls.map((call) => call[0]).sort();
    expect(recipients(sendOtp)).toEqual(expectedRecipients);
    expect(recipients(sendMagicLink)).toEqual(expectedRecipients);
  });

  it.each([
    ["/email-otp/send-verification-otp", "sendOtpEmail"],
    ["/sign-in/magic-link", "sendMagicLinkEmail"],
  ] as const)(
    "returns from %s without waiting for SMTP",
    async (path, method) => {
      const member = await createWorkspaceMember();
      const invite = await invitation("timing-invitee@example.com");
      vi.stubEnv("DISABLE_REGISTRATION", "true");
      let releaseDelivery!: () => void;
      const blockedDelivery = new Promise<void>((resolve) => {
        releaseDelivery = resolve;
      });
      const send = vi.spyOn(email, method).mockReturnValue(blockedDelivery);
      const responses: { status: number; body: unknown }[] = [];
      const requests: Promise<Response>[] = [];

      try {
        for (const address of [
          member.user.email,
          invite.email,
          "unknown@example.com",
        ]) {
          const request = post(
            path,
            { email: address, type: "sign-in" },
            {},
            false,
          );
          requests.push(request);
          void request.then(async (response) => {
            responses.push({
              status: response.status,
              body: await response.json(),
            });
          });
        }
        // The SMTP promise stays unresolved until all three HTTP responses arrive.
        await vi.waitFor(() => expect(responses).toHaveLength(3));
        expect(responses[0].status).toBe(200);
        expect(responses).toEqual([responses[0], responses[0], responses[0]]);
        await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
        expect(send.mock.calls.map(([address]) => address).sort()).toEqual(
          [member.user.email, invite.email].sort(),
        );
      } finally {
        releaseDelivery();
        await Promise.all(requests);
        await drainSignInEmails();
      }
    },
  );

  it("stores a five-minute OTP expiry and rejects an expired code", async () => {
    const member = await createWorkspaceMember();
    const send = vi.spyOn(email, "sendOtpEmail").mockResolvedValue(undefined);
    const before = Date.now();
    expect(
      (
        await post("/email-otp/send-verification-otp", {
          email: member.user.email,
          type: "sign-in",
        })
      ).status,
    ).toBe(200);
    const rows = await db.select().from(schema.verificationTable);
    expect(rows).toHaveLength(1);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 300_000,
    );
    expect(rows[0].expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 300_000,
    );
    const data = send.mock.lastCall?.[2] as { otp: string };
    await db
      .update(schema.verificationTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.verificationTable.id, rows[0].id));
    expect(
      (
        await post("/sign-in/email-otp", {
          email: member.user.email,
          otp: data.otp,
        })
      ).status,
    ).toBe(400);
    expect(await db.select().from(schema.sessionTable)).toHaveLength(0);
  });
});
