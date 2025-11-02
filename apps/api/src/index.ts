import { serve } from "@hono/node-server";
import type { Session, User } from "better-auth/types";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import activity from "./activity";
import { auth } from "./auth";
import config from "./config";
import db from "./database";
import githubIntegration from "./github-integration";
import label from "./label";

import notification from "./notification";
import project from "./project";
import { getPublicProject } from "./project/controllers/get-public-project";
import search from "./search";
import task from "./task";
import timeEntry from "./time-entry";
import { migrateWorkspaceUserEmail } from "./utils/migrate-workspace-user-email";

const app = new Hono<{
  Variables: {
    user: User | null;
    session: Session | null;
    userId: string;
  };
}>();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : undefined;

app.use(
  "*",
  cors({
    credentials: true,
    origin: (origin) => {
      if (!corsOrigins) {
        return origin || "*";
      }

      if (!origin) {
        return null;
      }

      return corsOrigins.includes(origin) ? origin : null;
    },
  }),
);

// Separate Hono instance for API routes (will be mounted at /api)
// This allows us to define routes without the /api prefix here,
// while the client in hono.ts knows to connect to /api
const api = new Hono<{
  Variables: {
    user: User | null;
    session: Session | null;
    userId: string;
  };
}>();

api.get("/health", (c) => {
  return c.json({ status: "ok" });
});

const configRoute = api.route("/config", config);

const githubIntegrationRoute = api.route(
  "/github-integration",
  githubIntegration,
);

const publicProjectRoute = api.get("/public-project/:id", async (c) => {
  const { id } = c.req.param();
  const project = await getPublicProject(id);

  return c.json(project);
});

api.on(["POST", "GET", "PUT", "DELETE"], "/auth/*", (c) =>
  auth.handler(c.req.raw),
);

api.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  c.set("user", session?.user || null);
  c.set("session", session?.session || null);
  c.set("userId", session?.user?.id || "");

  if (!session?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return next();
});

const projectRoute = api.route("/project", project);
const taskRoute = api.route("/task", task);
const activityRoute = api.route("/activity", activity);
const timeEntryRoute = api.route("/time-entry", timeEntry);
const labelRoute = api.route("/label", label);
const notificationRoute = api.route("/notification", notification);
const searchRoute = api.route("/search", search);

// Mount API routes under /api
app.route("/api", api);

(async () => {
  try {
    await migrateWorkspaceUserEmail();

    console.log("🔄 Migrating database...");
    await migrate(db, {
      migrationsFolder: `${process.cwd()}/drizzle`,
    });
    console.log("✅ Database migrated successfully!");
  } catch (error) {
    console.error("❌ Database migration failed!", error);
    process.exit(1);
  }
})();

serve(
  {
    fetch: app.fetch,
    port: 1337,
  },
  () => {
    console.log(
      `⚡ API is running at ${process.env.KANEO_API_URL || "http://localhost:1337"}`,
    );
  },
);

export type AppType =
  | typeof projectRoute
  | typeof taskRoute
  | typeof activityRoute
  | typeof timeEntryRoute
  | typeof labelRoute
  | typeof notificationRoute
  | typeof searchRoute
  | typeof publicProjectRoute
  | typeof githubIntegrationRoute
  | typeof configRoute;

export default app;
