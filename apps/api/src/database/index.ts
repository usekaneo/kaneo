import { Database } from 'bun:sqlite';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';

const sqlite = new Database('kaneo.db');

const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: 'drizzle' });

export default db;
