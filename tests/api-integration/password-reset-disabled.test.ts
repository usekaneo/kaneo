import { expect, it, vi } from "vitest";
import { auth } from "../../apps/api/src/auth";

vi.hoisted(() => {
  process.env.DISABLE_LOGIN_FORM = "true";
});

it.each([
  ["/request-password-reset", "POST", { email: "reset@example.com" }],
  ["/reset-password", "POST", { token: "token", newPassword: "new-password" }],
  [
    "/reset-password/token?callbackURL=http://localhost:5173/auth/reset-password",
    "GET",
    undefined,
  ],
] as const)(
  "blocks %s when local login is disabled",
  async (path, method, body) => {
    const response = await auth.handler(
      new Request(`http://localhost:1337/api/auth${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
    expect(response.status).toBe(403);
  },
);
