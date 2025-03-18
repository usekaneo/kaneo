import { jwt } from "@elysiajs/jwt";
import { Elysia, t } from "elysia";
import createSession from "./controllers/create-session";
import invalidateSession from "./controllers/invalidate-session";
import signIn from "./controllers/sign-in";
import signUp from "./controllers/sign-up";
import generateSessionToken from "./utils/generate-session-token";
import isInSecureMode from "./utils/is-in-secure-mode";

const user = new Elysia({ prefix: "/user" })
  .use(
    jwt({
      name: "sessionToken",
      secret: process.env.JWT_ACCESS ?? "",
    }),
  )
  .post(
    "/sign-in",
    async ({ body: { email, password }, set, request }) => {
      const user = await signIn(email, password);

      const token = generateSessionToken();
      const session = await createSession(token, user.id);
      set.cookie = {
        session: {
          value: token,
          httpOnly: true,
          path: "/",
          secure: isInSecureMode(request),
          sameSite: "lax",
          expires: session.expiresAt,
        },
      };

      return user;
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
      }),
    },
  )
  .post(
    "/sign-up",
    async ({ body: { email, password, name }, set, request }) => {
      const user = await signUp(email, password, name);

      if (!user) throw new Error("Failed to create an account");

      const token = generateSessionToken();
      const session = await createSession(token, user.id);
      set.cookie = {
        session: {
          value: token,
          httpOnly: true,
          path: "/",
          secure: isInSecureMode(request),
          sameSite: "lax",
          expires: session.expiresAt,
        },
      };

      return user;
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
        name: t.String(),
      }),
    },
  )
  .post("/sign-out", async ({ cookie, cookie: { session } }) => {
    await invalidateSession(session?.value ?? "");
    session.remove();

    // biome-ignore lint/performance/noDelete: https://elysiajs.com/patterns/cookie#remove
    delete cookie.session;
  })
  .onError(({ code, error }) => {
    switch (code) {
      case "VALIDATION":
        return error.all;
      default:
        if (error instanceof Error) {
          return {
            name: error.name,
            message: error.message,
          };
        }
    }
  });

export default user;
