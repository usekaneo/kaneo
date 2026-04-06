import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveRedisMode } from "../../../apps/api/src/redis/index";

describe("resolveRedisMode priority resolution", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_SENTINELS;
    delete process.env.REDIS_CLUSTER_NODES;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_SENTINEL_MASTER_NAME;
    delete process.env.REDIS_SENTINEL_PASSWORD;
    delete process.env.REDIS_SENTINEL_TLS;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("selects Cluster mode when REDIS_CLUSTER_NODES is set (highest priority)", () => {
    process.env.REDIS_CLUSTER_NODES = "node-1:6379,node-2:6379";
    process.env.REDIS_SENTINELS = "sentinel-1:26379";
    process.env.REDIS_URL = "redis://localhost:6379";

    const result = resolveRedisMode();

    expect(result).toEqual({
      mode: "cluster",
      nodes: [
        { host: "node-1", port: 6379 },
        { host: "node-2", port: 6379 },
      ],
      password: undefined,
    });
  });

  it("selects Sentinel mode when REDIS_SENTINELS is set (no cluster)", () => {
    process.env.REDIS_SENTINELS = "sentinel-1:26379,sentinel-2:26379";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.REDIS_SENTINEL_MASTER_NAME = "mymaster";
    process.env.REDIS_PASSWORD = "secret";

    const result = resolveRedisMode();

    expect(result).toEqual({
      mode: "sentinel",
      sentinels: [
        { host: "sentinel-1", port: 26379 },
        { host: "sentinel-2", port: 26379 },
      ],
      name: "mymaster",
      password: "secret",
      sentinelPassword: undefined,
      enableTLSForSentinelMode: false,
    });
  });

  it("selects Standalone mode when only REDIS_URL is set (lowest priority)", () => {
    process.env.REDIS_URL = "redis://localhost:6379";

    const result = resolveRedisMode();

    expect(result).toEqual({
      mode: "standalone",
      url: "redis://localhost:6379",
    });
  });

  it("throws when no Redis configuration is provided", () => {
    expect(() => resolveRedisMode()).toThrow(
      "REDIS_URL, REDIS_SENTINELS, or REDIS_CLUSTER_NODES must be set",
    );
  });

  it("passes REDIS_PASSWORD to Cluster config", () => {
    process.env.REDIS_CLUSTER_NODES = "node-1:6379";
    process.env.REDIS_PASSWORD = "clusterpass";

    const result = resolveRedisMode();

    expect(result).toEqual(
      expect.objectContaining({
        mode: "cluster",
        password: "clusterpass",
      }),
    );
  });

  it("passes sentinel-specific options correctly", () => {
    process.env.REDIS_SENTINELS = "sentinel-1:26379";
    process.env.REDIS_SENTINEL_PASSWORD = "sentinelpass";
    process.env.REDIS_SENTINEL_TLS = "true";

    const result = resolveRedisMode();

    expect(result).toEqual(
      expect.objectContaining({
        mode: "sentinel",
        sentinelPassword: "sentinelpass",
        enableTLSForSentinelMode: true,
      }),
    );
  });

  it("defaults REDIS_SENTINEL_MASTER_NAME to 'mymaster'", () => {
    process.env.REDIS_SENTINELS = "sentinel-1:26379";

    const result = resolveRedisMode();

    expect(result).toEqual(
      expect.objectContaining({
        mode: "sentinel",
        name: "mymaster",
      }),
    );
  });

  it("disables sentinel TLS when REDIS_SENTINEL_TLS is not 'true'", () => {
    process.env.REDIS_SENTINELS = "sentinel-1:26379";
    process.env.REDIS_SENTINEL_TLS = "false";

    const result = resolveRedisMode();

    expect(result).toEqual(
      expect.objectContaining({
        mode: "sentinel",
        enableTLSForSentinelMode: false,
      }),
    );
  });

  it("passes REDIS_PASSWORD to Sentinel config", () => {
    process.env.REDIS_SENTINELS = "sentinel-1:26379";
    process.env.REDIS_PASSWORD = "redispass";

    const result = resolveRedisMode();

    expect(result).toEqual(
      expect.objectContaining({
        mode: "sentinel",
        password: "redispass",
      }),
    );
  });
});
