import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { cors } from "hono/cors";
import activity from "./activity";
import db from "./database";
import { auth } from "./middlewares/auth";
import project from "./project";
import task from "./task";
import user from "./user";
import { validateSessionToken } from "./user/utils/validate-session-token";
import setDemoUser from "./utils/set-demo-user";
import workspace from "./workspace";
import workspaceUser from "./workspace-user";

const app = new Hono<{ Variables: { userEmail: string } }>();

const isDemoMode = process.env.DEMO_MODE === "true";

app.use(
  "*",
  cors({
    credentials: true,
    origin: (origin) => origin || "*",
  }),
);

const userRoute = app.route("/user", user);

app.use("*", auth);

app.use("*", async (c, next) => {
  if (isDemoMode) {
    const session = getCookie(c, "session");

    if (!session) {
      await setDemoUser(c);
    }

    const { user, session: validatedSession } = await validateSessionToken(
      session ?? "",
    );

    if (!user || !validatedSession) {
      await setDemoUser(c);
    }

    c.set("userEmail", user?.email ?? "");
  }

  await next();
});

const meRoute = app.get("/me", async (c) => {
  const session = getCookie(c, "session");

  if (!session) {
    return c.json({ user: null });
  }

  const { user } = await validateSessionToken(session);

  if (user === null) {
    return c.json({ user: null });
  }

  return c.json({ user });
});

const workspaceRoute = app.route("/workspace", workspace);
const workspaceUserRoute = app.route("/workspace-user", workspaceUser);
const projectRoute = app.route("/project", project);
const taskRoute = app.route("/task", task);
const activityRoute = app.route("/activity", activity);

try {
  console.log("Migrating database...");
  migrate(db, {
    migrationsFolder: `${process.cwd()}/drizzle`,
  });
} catch (error) {
  console.error(error);
}

serve(
  {
    fetch: app.fetch,
    port: 1337,
  },
  (info) => {
    console.log(`🏃 Hono API is running at http://localhost:${info.port}`);
  },
);

export type AppType =
  | typeof userRoute
  | typeof workspaceRoute
  | typeof workspaceUserRoute
  | typeof projectRoute
  | typeof taskRoute
  | typeof activityRoute
  | typeof meRoute;
