import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import isInSecureMode from "../user/utils/is-in-secure-mode";
import { validateSessionToken } from "../user/utils/validate-session-token";

export const auth = createMiddleware(async (c, next) => {
  const token = getCookie(c, "session");

  if (!token) {
    return c.json({ user: null });
  }

  const { user, session: validatedSession } = await validateSessionToken(token);

  if (!user || !validatedSession) {
    return c.json({ user: null });
  }

  setCookie(c, "session", token, {
    path: "/",
    secure: isInSecureMode(c.req),
    sameSite: "lax",
    expires: validatedSession.expiresAt,
  });

  c.set("userEmail", user.email);

  return next();
});
