import path from "node:path";
import { cors } from "@elysiajs/cors";
import { cron } from "@elysiajs/cron";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Elysia } from "elysia";
import db from "./database";
import project from "./project";
import task from "./task";
import user from "./user";
import { validateSessionToken } from "./user/controllers/validate-session-token";
import { createDemoUser } from "./utils/create-demo-user";
import purgeData from "./utils/purge-demo-data";
import workspace from "./workspace";
import workspaceUser from "./workspace-user";

const app = new Elysia()
  .state("userEmail", "")
  .use(cors())
  .use(user)
  .use(
    cron({
      name: "purge-demo-data",
      pattern: "0 0 * * *",
      run: async () => {
        const isDemoMode = process.env.DEMO_MODE === "true";

        if (isDemoMode) {
          console.log("Purging demo data");
          await purgeData();
        }
      },
    }),
  )
  .guard({
    async beforeHandle({ store, cookie: { session }, set }) {
      const isDemoMode = process.env.DEMO_MODE === "true";

      if (isDemoMode && !session?.value) {
        const {
          id,
          name,
          email,
          session: demoSession,
          expiresAt,
        } = await createDemoUser();

        set.cookie = {
          session: {
            value: demoSession,
            httpOnly: true,
            path: "/",
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            expires: expiresAt,
          },
        };

        return {
          user: {
            id,
            name,
            email,
          },
        };
      }

      if (!session?.value) {
        return { user: null };
      }

      const { user, session: validatedSession } = await validateSessionToken(
        session.value,
      );

      if (!user || !validatedSession) {
        return { user: null };
      }

      store.userEmail = user.email;
    },
  })
  .get("/me", async ({ cookie: { session } }) => {
    const { user } = await validateSessionToken(session.value ?? "");

    if (user === null) {
      return { user: null };
    }

    return { user };
  })
  .use(workspace)
  .use(project)
  .use(task)
  .use(workspaceUser)
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
  })
  .listen(1337);

export type App = typeof app;

migrate(db, {
  migrationsFolder: path.join(__dirname, "../drizzle"),
});

console.log(`🏃 Kaneo is running at ${app.server?.url}`);
