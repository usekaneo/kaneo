import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbPath = process.env.DB_PATH
  ? process.env.DB_PATH
  : join(process.cwd(), "kaneo.db");

const sqlite = new Database(dbPath);

const db = drizzle(sqlite, { schema });

export default db;
