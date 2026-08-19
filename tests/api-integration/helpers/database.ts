import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import db, { schema } from "../../../apps/api/src/database";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDir, "../../../apps/api/drizzle");

const drizzleNameSymbol = Object.getOwnPropertySymbols(
  Object.values(schema).find((value) => value && typeof value === "object") ??
    {},
).find((sym) => sym.toString() === "Symbol(drizzle:Name)");

if (!drizzleNameSymbol) {
  throw new Error(
    "Could not locate Drizzle table name symbol; schema introspection changed",
  );
}

function getTruncateTableNames() {
  return Object.entries(schema)
    .filter(
      ([key, value]) =>
        key.endsWith("Table") &&
        !key.endsWith("TableRelations") &&
        value &&
        typeof value === "object" &&
        drizzleNameSymbol in value,
    )
    .map(
      ([, value]) =>
        (value as Record<symbol, unknown>)[drizzleNameSymbol] as string,
    )
    .sort();
}

let migrationPromise: Promise<void> | null = null;

function getDatabaseName(connectionString: string) {
  return new URL(connectionString).pathname.replace(/^\//, "");
}

function getAdminDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  url.pathname = "/postgres";
  return url.toString();
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function ensureTestDatabaseExists() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be defined for integration tests");
  }

  const databaseName = getDatabaseName(connectionString);

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to manage non-test database "${databaseName}". DATABASE_URL must point to a test database.`,
    );
  }

  const adminClient = new Client({
    connectionString: getAdminDatabaseUrl(connectionString),
  });

  await adminClient.connect();

  try {
    const result = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );

    if (result.rowCount === 0) {
      await adminClient.query(
        `CREATE DATABASE ${quoteIdentifier(databaseName)}`,
      );
    }
  } finally {
    await adminClient.end();
  }
}

export async function ensureTestDatabaseMigrated() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      await ensureTestDatabaseExists();
      await migrate(db, {
        migrationsFolder,
      });
    })();
  }

  try {
    await migrationPromise;
  } catch (error) {
    migrationPromise = null;
    throw error;
  }
}

export async function resetTestDatabase() {
  await ensureTestDatabaseMigrated();

  const tableNames = getTruncateTableNames();
  const formattedTableNames = tableNames.map((name) => `"${name}"`).join(", ");

  await db.execute(
    sql.raw(`TRUNCATE TABLE ${formattedTableNames} RESTART IDENTITY CASCADE`),
  );
}
