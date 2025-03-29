import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import db from "../database";
import { auth } from "./middlewares/is-authenticated";
import user from "./user";
import workspace from "./workspace";

const app = new Hono();

app.use("*", cors());

const userRoute = app.route("/user", user);

app.use("*", auth);

const workspaceRoute = app.route("/workspace", workspace);

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

export type AppType = typeof userRoute | typeof workspaceRoute;
