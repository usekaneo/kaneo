import { resolveFileSecret } from "../utils/file-secret";

const LOCAL_FALLBACK_CONNECTION_STRING = "postgresql://localhost:5432/kaneo";
const DEFAULT_POOL_MAX = 10;

type DatabaseConfigSource = "DATABASE_URL" | "POSTGRES_ENV" | "LOCAL_FALLBACK";

export type ResolvedDatabaseConfig = {
  connectionString: string;
  source: DatabaseConfigSource;
  host: string;
  port: number;
  database: string;
  username: string;
  poolMax: number;
  logConfig: {
    source: DatabaseConfigSource;
    host: string;
    port: number;
    database: string;
    username: string;
    poolMax: number;
  };
};

function getDerivationSignal(): boolean {
  return Boolean(
    process.env.POSTGRES_PASSWORD ||
    process.env.POSTGRES_PASSWORD_FILE ||
    process.env.POSTGRES_HOST ||
    process.env.POSTGRES_PORT,
  );
}

function toResolvedConfig(
  connectionString: string,
  source: DatabaseConfigSource,
): ResolvedDatabaseConfig {
  const url = new URL(connectionString);

  const logConfig = {
    source,
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ""),
    username: decodeURIComponent(url.username),
    poolMax: resolveDatabasePoolMax(),
  };

  return {
    connectionString,
    ...logConfig,
    logConfig,
  };
}

export function resolveDatabaseConfig(): ResolvedDatabaseConfig {
  if (process.env.DATABASE_URL) {
    return toResolvedConfig(process.env.DATABASE_URL, "DATABASE_URL");
  }

  if (getDerivationSignal()) {
    const rawPassword = resolveFileSecret("POSTGRES_PASSWORD");
    if (!rawPassword) {
      throw new Error(
        "POSTGRES_PASSWORD must be set when deriving DATABASE_URL from POSTGRES_* variables",
      );
    }

    const username = process.env.POSTGRES_USER || "kaneo";
    const password = encodeURIComponent(rawPassword);
    const host = process.env.POSTGRES_HOST || "postgres";
    const port = process.env.POSTGRES_PORT || "5432";
    const database = process.env.POSTGRES_DB || "kaneo";

    return toResolvedConfig(
      `postgresql://${encodeURIComponent(username)}:${password}@${host}:${port}/${database}`,
      "POSTGRES_ENV",
    );
  }

  return toResolvedConfig(LOCAL_FALLBACK_CONNECTION_STRING, "LOCAL_FALLBACK");
}

export function resolveDatabaseConnectionString(): string {
  return resolveDatabaseConfig().connectionString;
}

export function resolveDatabasePoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX?.trim();
  if (!raw) {
    return DEFAULT_POOL_MAX;
  }

  const value = Number(raw);
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(value)) {
    throw new Error("DATABASE_POOL_MAX must be a positive integer");
  }

  return value;
}
