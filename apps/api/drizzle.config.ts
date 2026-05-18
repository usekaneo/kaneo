import { config } from "dotenv-mono";
import { type Config, defineConfig } from "drizzle-kit";
import { resolveDatabaseConnectionString } from "./src/database/resolve-database-url";

config();

export default defineConfig({
  out: "./drizzle",
  schema: "./src/database/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseConnectionString(),
  },
}) satisfies Config;
