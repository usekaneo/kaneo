import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import signIn from "./controllers/sign-in";
import signUp from "./controllers/sign-up";
import createSession from "./utils/create-session";
import generateSessionToken from "./utils/generate-session-token";
import invalidateSession from "./utils/invalidate-session";
import isInSecureMode from "./utils/is-in-secure-mode";

const user = new Hono()
  .post(
    "/sign-in",
    zValidator("json", z.object({ email: z.string(), password: z.string() })),
    async (c) => {
      const { email, password } = c.req.valid("json");

      const user = await signIn(email, password);

      const token = generateSessionToken();
      const session = await createSession(token, user.id);

      setCookie(c, "session", token, {
        path: "/",
        secure: isInSecureMode(c.req),
        sameSite: "lax",
        expires: session.expiresAt,
      });

      return c.json(user);
    },
  )
  .post(
    "/sign-up",
    zValidator(
      "json",
      z.object({ email: z.string(), password: z.string(), name: z.string() }),
    ),
    async (c) => {
      const { email, password, name } = c.req.valid("json");

      const user = await signUp(email, password, name);

      const token = generateSessionToken();
      const session = await createSession(token, user.id);

      setCookie(c, "session", token, {
        path: "/",
        secure: isInSecureMode(c.req),
        sameSite: "lax",
        expires: session.expiresAt,
      });

      return c.json(user);
    },
  )
  .post("/sign-out", async (c) => {
    const token = getCookie(c, "session");

    if (!token) {
      return c.json({ message: "No session token found" }, 401);
    }

    await invalidateSession(token);
    deleteCookie(c, "session");

    return c.json({ message: "Signed out" });
  });

export default user;
