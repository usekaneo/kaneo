import { resolve } from "node:path";
import { config } from "dotenv-mono";
import { resolveDatabaseConfig } from "../src/database/resolve-database-url";
import { runQuillsMigrations } from "../src/database/quills/migrate";
config();
const database = resolveDatabaseConfig();
await runQuillsMigrations(
  process.env.QUILLS_MIGRATION_DATABASE_URL || database.connectionString,
  resolve("drizzle/quills"),
  database.username || undefined,
);
