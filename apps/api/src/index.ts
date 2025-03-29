import path from "node:path";
import { cors } from "@elysiajs/cors";
import { cron } from "@elysiajs/cron";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Elysia } from "elysia";
import activity from "./activity";
import db from "./database";
import purgeData from "./utils/purge-demo-data";
import setDemoUser from "./utils/set-demo-user";

const isDemoMode = process.env.DEMO_MODE === "true";

const app = new Elysia()
  .state("userEmail", "")
  .use(cors())
  .use(
    cron({
      name: "purge-demo-data",
      pattern: "30 * * * *",
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
    async beforeHandle({ cookie: { session }, set }) {
      if (isDemoMode) {
        if (!session?.value) {
          await setDemoUser(set);
        }

        // TODO:
        // const { user, session: validatedSession } = await validateSessionToken(
        //   session.value ?? "",
        // );

        // if (!user || !validatedSession) {
        //   await setDemoUser(set);
        // }

        // store.userEmail = user?.email ?? "";
      }
    },
  })

  .use(activity)
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
