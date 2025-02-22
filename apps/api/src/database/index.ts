import { Database } from "bun:sqlite";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const dbPath = process.env.DB_PATH
  ? process.env.DB_PATH
  : join(process.cwd(), "kaneo.db");
const sqlite = new Database(dbPath);

const db = drizzle(sqlite, { schema });

export default db;
