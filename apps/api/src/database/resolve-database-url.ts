const LOCAL_FALLBACK_CONNECTION_STRING =
  "postgresql://kaneo_user:kaneo_password@localhost:5432/kaneo";

type DatabaseConfigSource = "DATABASE_URL" | "POSTGRES_ENV" | "LOCAL_FALLBACK";

export type ResolvedDatabaseConfig = {
  connectionString: string;
  source: DatabaseConfigSource;
  host: string;
  port: number;
  database: string;
  username: string;
  logConfig: {
    source: DatabaseConfigSource;
    host: string;
    port: number;
    database: string;
    username: string;
  };
};

function getDerivationSignal(): boolean {
  return Boolean(
    process.env.POSTGRES_PASSWORD ||
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
    if (!process.env.POSTGRES_PASSWORD) {
      throw new Error(
        "POSTGRES_PASSWORD must be set when deriving DATABASE_URL from POSTGRES_* variables",
      );
    }

    const username = process.env.POSTGRES_USER || "kaneo";
    const password = encodeURIComponent(process.env.POSTGRES_PASSWORD);
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
