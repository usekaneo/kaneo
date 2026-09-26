import * as email from "@kaneo/email";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

vi.hoisted(() => {
  process.env.DISABLE_EMAIL_OTP_SIGN_IN = "true";
});

const origin = "http://localhost:5173";
const address = "reset@example.com";
const password = "old-password-123";
const newPassword = "new-password-456";
const redirectTo = `${origin}/auth/reset-password`;
function post(path: string, body: unknown) {
  return createApp().app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await resetTestDatabase();
  // Better Auth skips origin checks in test mode unless explicitly enabled.
  (await auth.$context).skipOriginCheck = false;
  vi.spyOn(email, "isSmtpConfigured").mockReturnValue(true);
  vi.spyOn(email, "sendPasswordResetEmail").mockResolvedValue();
  expect(
    (
      await post("/sign-up/email", {
        name: "Reset user",
        email: address,
        password,
        locale: "de-DE",
      })
    ).status,
  ).toBe(200);
});
afterEach(() => vi.unstubAllEnvs());

async function requestReset() {
  const response = await post("/request-password-reset", {
    email: address,
    redirectTo,
  });
  expect(response.status).toBe(200);
  await vi.waitFor(() =>
    expect(email.sendPasswordResetEmail).toHaveBeenCalled(),
  );
  const props = vi.mocked(email.sendPasswordResetEmail).mock.calls.at(-1)?.[2];
  expect(props).toEqual(
    expect.objectContaining({ locale: "de-DE", userName: "Reset user" }),
  );
  const link = new URL((props as { resetLink: string }).resetLink);
  expect(link.origin).toBe("http://localhost:1337");
  expect(link.searchParams.get("callbackURL")).toBe(redirectTo);
  expect(vi.mocked(email.sendPasswordResetEmail).mock.calls.at(-1)?.[1]).toBe(
    "Kaneo-Passwort zurücksetzen",
  );
  return { link, token: link.pathname.split("/").at(-1) };
}

describe("password reset with email OTP disabled", () => {
  it("emails a one-hour link, changes the password, revokes sessions and rejects reuse", async () => {
    expect(
      auth.options.plugins.some((plugin) => plugin.id === "email-otp"),
    ).toBe(false);
    const { link, token } = await requestReset();
    const [verification] = await db.select().from(schema.verificationTable);
    expect(verification.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      3_500_000,
    );
    expect(verification.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(
      3_600_000,
    );
    const callback = await createApp().app.request(
      `${link.pathname}${link.search}`,
    );
    expect(callback.status).toBe(302);
    const destination = new URL(callback.headers.get("location") as string);
    expect(destination.origin + destination.pathname).toBe(redirectTo);
    expect(destination.searchParams.get("token")).toBe(token);
    expect(await db.select().from(schema.sessionTable)).not.toHaveLength(0);
    expect((await post("/reset-password", { token, newPassword })).status).toBe(
      200,
    );
    expect(await db.select().from(schema.sessionTable)).toHaveLength(0);
    expect(
      (await post("/sign-in/email", { email: address, password })).status,
    ).toBe(401);
    expect(
      (await post("/sign-in/email", { email: address, password: newPassword }))
        .status,
    ).toBe(200);
    expect(
      (await post("/reset-password", { token, newPassword: password })).status,
    ).toBe(400);
  });

  it("immediately rejects old cached cookies on session and protected API requests", async () => {
    const context = await auth.$context;
    const cookieCache = context.options.session?.cookieCache;
    if (!cookieCache) throw new Error("Missing cookie cache configuration");
    const originalEnabled = cookieCache.enabled;
    let cookie: string;
    try {
      // Model a cookie issued before upgrading from the cached-session config.
      cookieCache.enabled = true;
      const signIn = await post("/sign-in/email", { email: address, password });
      expect(signIn.status).toBe(200);
      cookie = signIn.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      expect(cookie.includes("session_data=")).toBe(true);
    } finally {
      cookieCache.enabled = originalEnabled;
    }
    const headers = { Cookie: cookie, Origin: origin };
    const { app } = createApp();
    expect((await app.request("/api/notification", { headers })).status).toBe(
      200,
    );
    const { token } = await requestReset();
    expect((await post("/reset-password", { token, newPassword })).status).toBe(
      200,
    );
    expect(await db.select().from(schema.sessionTable)).toHaveLength(0);
    expect((await app.request("/api/notification", { headers })).status).toBe(
      401,
    );
    const session = await app.request("/api/auth/get-session", { headers });
    expect(await session.json()).toBeNull();
  });

  it("gives the same confirmation for existing and unknown accounts without sending unknown-account mail", async () => {
    const known = await post("/request-password-reset", {
      email: address,
      redirectTo,
    });
    await vi.waitFor(() =>
      expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1),
    );
    const unknown = await post("/request-password-reset", {
      email: "unknown@example.com",
      redirectTo,
    });
    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
    expect(email.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it("rejects expired and invalid tokens without changing the password", async () => {
    const { link, token } = await requestReset();
    await db
      .update(schema.verificationTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(
        eq(schema.verificationTable.identifier, `reset-password:${token}`),
      );
    const callback = await createApp().app.request(
      `${link.pathname}${link.search}`,
    );
    expect(
      new URL(callback.headers.get("location") as string).searchParams.get(
        "error",
      ),
    ).toBe("INVALID_TOKEN");
    for (const invalid of [token, "invalid-token"]) {
      expect(
        (await post("/reset-password", { token: invalid, newPassword })).status,
      ).toBe(400);
    }
    expect(
      (await post("/sign-in/email", { email: address, password })).status,
    ).toBe(200);
  });

  it("validates passwords without consuming the reset token", async () => {
    const { token } = await requestReset();
    for (const invalid of ["short", "x".repeat(129)]) {
      expect(
        (await post("/reset-password", { token, newPassword: invalid })).status,
      ).toBe(400);
    }
    expect((await post("/reset-password", { token, newPassword })).status).toBe(
      200,
    );
  });

  it("rejects untrusted redirects and requests without SMTP", async () => {
    expect(
      (
        await post("/request-password-reset", {
          email: address,
          redirectTo: "https://untrusted.example/reset",
        })
      ).status,
    ).toBe(403);
    vi.mocked(email.isSmtpConfigured).mockReturnValue(false);
    expect(
      (await post("/request-password-reset", { email: address, redirectTo }))
        .status,
    ).toBe(403);
    expect(email.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(await db.select().from(schema.verificationTable)).toHaveLength(0);
  });
});
