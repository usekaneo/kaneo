import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { cors } from "hono/cors";
import db from "../database";
import { auth } from "./middlewares/is-authenticated";
import project from "./project";
import task from "./task";
import user from "./user";
import { validateSessionToken } from "./user/utils/validate-session-token";
import workspace from "./workspace";
import workspaceUser from "./workspace-user";

const app = new Hono();

app.use(
  "*",
  cors({
    credentials: true,
    origin: ["https://kaneo.app", "http://localhost:5173"],
  }),
);

const userRoute = app.route("/user", user);

app.use("*", auth);

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

migrate(db, {
  migrationsFolder: `${process.cwd()}/drizzle`,
});

serve(
  {
    fetch: app.fetch,
    port: 1336,
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
  | typeof meRoute;
