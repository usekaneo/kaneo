// @ts-ignore - This is used by Elysia
import type { ElysiaCookie } from "elysia/dist/cookies";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import isInSecureMode from "../user/utils/is-in-secure-mode";
import { createDemoUser } from "./create-demo-user";

async function setDemoUser(c: Context) {
  const demoExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const { session: demoSession, expiresAt = demoExpiresAt } =
    await createDemoUser();

  setCookie(c, "session", demoSession, {
    httpOnly: isInSecureMode(c.req),
    path: "/",
    secure: true,
    sameSite: "lax",
    expires: expiresAt,
  });
}

export default setDemoUser;
