import Redis, { type Cluster } from "ioredis";

export type RedisClient = Redis | Cluster;

let _redisPub: RedisClient | null = null;
let _redisSub: RedisClient | null = null;

function isRedisConfigured(): boolean {
  return !!(
    process.env.REDIS_URL ||
    process.env.REDIS_SENTINELS ||
    process.env.REDIS_CLUSTER_NODES
  );
}

export function parseNodeList(
  raw: string,
  envName: string,
  defaultPort: number,
): { host: string; port: number }[] {
  const nodes = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      let host: string;
      let portStr: string | undefined;

      if (entry.startsWith("[")) {
        // IPv6 bracket notation: [::1]:6379
        const closingBracket = entry.indexOf("]");
        if (closingBracket === -1) {
          throw new Error(
            `Invalid entry "${entry}" in ${envName}: missing closing bracket for IPv6 address`,
          );
        }
        host = entry.slice(1, closingBracket);
        const afterBracket = entry.slice(closingBracket + 1);
        if (afterBracket.startsWith(":")) {
          portStr = afterBracket.slice(1);
        } else if (afterBracket.length > 0) {
          throw new Error(
            `Invalid entry "${entry}" in ${envName}: unexpected characters after IPv6 address`,
          );
        }
      } else {
        const colonCount = entry.split(":").length - 1;
        if (colonCount > 1) {
          // Multiple colons — bare IPv6 address without brackets (e.g. "::1")
          host = entry;
        } else if (colonCount === 1) {
          // Exactly one colon — standard host:port
          const colonIdx = entry.indexOf(":");
          host = entry.slice(0, colonIdx);
          portStr = entry.slice(colonIdx + 1);
        } else {
          // No colons — hostname only
          host = entry;
        }
      }

      if (!host) {
        throw new Error(
          `Invalid entry "${entry}" in ${envName}: host is missing`,
        );
      }
      const port = portStr ? Number(portStr) : defaultPort;
      if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error(
          `Invalid entry "${entry}" in ${envName}: port must be a number between 1 and 65535`,
        );
      }
      return { host, port };
    });

  if (nodes.length === 0) {
    throw new Error(`${envName} is set but contains no valid entries`);
  }

  return nodes;
}

type RedisMode =
  | {
      mode: "cluster";
      nodes: { host: string; port: number }[];
      password?: string;
    }
  | {
      mode: "sentinel";
      sentinels: { host: string; port: number }[];
      name: string;
      password?: string;
      sentinelPassword?: string;
      enableTLSForSentinelMode: boolean;
    }
  | { mode: "standalone"; url: string };

export function resolveRedisMode(): RedisMode {
  const clusterNodes = process.env.REDIS_CLUSTER_NODES;
  if (clusterNodes) {
    return {
      mode: "cluster",
      nodes: parseNodeList(clusterNodes, "REDIS_CLUSTER_NODES", 6379),
      password: process.env.REDIS_PASSWORD,
    };
  }

  const sentinels = process.env.REDIS_SENTINELS;
  if (sentinels) {
    return {
      mode: "sentinel",
      sentinels: parseNodeList(sentinels, "REDIS_SENTINELS", 26379),
      name: process.env.REDIS_SENTINEL_MASTER_NAME || "mymaster",
      password: process.env.REDIS_PASSWORD,
      sentinelPassword: process.env.REDIS_SENTINEL_PASSWORD,
      enableTLSForSentinelMode: process.env.REDIS_SENTINEL_TLS === "true",
    };
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL, REDIS_SENTINELS, or REDIS_CLUSTER_NODES must be set",
    );
  }
  return { mode: "standalone", url };
}

function createRedisClient(): RedisClient {
  const config = resolveRedisMode();

  switch (config.mode) {
    case "cluster":
      return new Redis.Cluster(config.nodes, {
        redisOptions: { password: config.password },
        clusterRetryStrategy: (times) => Math.min(times * 100, 3000),
      });
    case "sentinel":
      return new Redis({
        sentinels: config.sentinels,
        name: config.name,
        password: config.password,
        sentinelPassword: config.sentinelPassword,
        enableTLSForSentinelMode: config.enableTLSForSentinelMode,
      });
    case "standalone":
      return new Redis(config.url);
  }
}

export { isRedisConfigured };

export function getRedisPub(): RedisClient {
  if (!_redisPub) {
    _redisPub = createRedisClient();
    _redisPub.on("error", (err) =>
      console.error("Redis pub client error:", err),
    );
  }
  return _redisPub;
}

export function getRedisSub(): RedisClient {
  if (!_redisSub) {
    _redisSub = createRedisClient();
    _redisSub.on("error", (err) =>
      console.error("Redis sub client error:", err),
    );
  }
  return _redisSub;
}

export async function closeRedis(): Promise<void> {
  if (_redisPub) {
    await _redisPub.quit();
    _redisPub = null;
  }
  if (_redisSub) {
    await _redisSub.quit();
    _redisSub = null;
  }
}
