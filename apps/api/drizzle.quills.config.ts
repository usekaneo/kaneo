import { config } from "dotenv-mono";
import { defineConfig } from "drizzle-kit";
import { resolveDatabaseConnectionString } from "./src/database/resolve-database-url";
config();
export default defineConfig({
  schema: "./src/database/quills/schema/index.ts",
  out: "./drizzle/quills",
  dialect: "postgresql",
  schemaFilter: ["quills"],
  migrations: { schema: "quills_migrations", table: "__drizzle_migrations" },
  dbCredentials: { url: resolveDatabaseConnectionString() },
});
