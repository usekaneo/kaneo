import { serve } from "@hono/node-server";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import db from "../database";
import { type route, user } from "./user";

const app = new Hono();

app.use("*", cors());
app.route("/user", user);

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

export type AppType = typeof route;
