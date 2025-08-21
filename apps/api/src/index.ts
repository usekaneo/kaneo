import { serve } from "@hono/node-server";
import { Cron } from "croner";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import app from "./app";
import db from "./database";
import getSettings from "./utils/get-settings";
import purgeDemoData from "./utils/purge-demo-data";

const { isDemoMode } = getSettings();

if (isDemoMode) {
  new Cron("0 * * * *", async () => {
    await purgeDemoData();
  });
}

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
