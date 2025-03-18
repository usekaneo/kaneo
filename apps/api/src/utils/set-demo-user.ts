// @ts-ignore - This is used by Elysia
import type { ElysiaCookie } from "elysia/dist/cookies";
import { createDemoUser } from "./create-demo-user";

async function setDemoUser(set: { cookie?: Record<string, ElysiaCookie> }) {
  const demoExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const { session: demoSession, expiresAt = demoExpiresAt } =
    await createDemoUser();

  set.cookie = {
    session: {
      value: demoSession,
      httpOnly: true,
      path: "/",
      secure: true,
      sameSite: "lax",
      expires: expiresAt,
    },
  };
}

export default setDemoUser;
