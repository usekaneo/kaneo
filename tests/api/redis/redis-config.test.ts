import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isRedisConfigured,
  parseNodeList,
} from "../../../apps/api/src/redis/index";

describe("parseNodeList", () => {
  describe("basic hostname:port parsing", () => {
    it("parses a single host:port entry", () => {
      const result = parseNodeList("redis-1:6379", "REDIS_CLUSTER_NODES", 6379);
      expect(result).toEqual([{ host: "redis-1", port: 6379 }]);
    });

    it("parses multiple host:port entries", () => {
      const result = parseNodeList(
        "redis-1:6379,redis-2:6380,redis-3:6381",
        "REDIS_CLUSTER_NODES",
        6379,
      );
      expect(result).toEqual([
        { host: "redis-1", port: 6379 },
        { host: "redis-2", port: 6380 },
        { host: "redis-3", port: 6381 },
      ]);
    });

    it("uses the default port when port is omitted", () => {
      const result = parseNodeList("redis-1", "REDIS_SENTINELS", 26379);
      expect(result).toEqual([{ host: "redis-1", port: 26379 }]);
    });

    it("uses the default port for entries without port in a mixed list", () => {
      const result = parseNodeList(
        "redis-1:7000,redis-2",
        "REDIS_CLUSTER_NODES",
        6379,
      );
      expect(result).toEqual([
        { host: "redis-1", port: 7000 },
        { host: "redis-2", port: 6379 },
      ]);
    });

    it("trims whitespace around entries", () => {
      const result = parseNodeList(
        " redis-1:6379 , redis-2:6380 ",
        "REDIS_CLUSTER_NODES",
        6379,
      );
      expect(result).toEqual([
        { host: "redis-1", port: 6379 },
        { host: "redis-2", port: 6380 },
      ]);
    });

    it("skips empty entries from extra commas", () => {
      const result = parseNodeList(
        ",redis-1:6379,,redis-2:6380,",
        "REDIS_CLUSTER_NODES",
        6379,
      );
      expect(result).toEqual([
        { host: "redis-1", port: 6379 },
        { host: "redis-2", port: 6380 },
      ]);
    });
  });

  describe("IPv6 address handling", () => {
    it("parses bracketed IPv6 with port", () => {
      const result = parseNodeList("[::1]:6379", "REDIS_CLUSTER_NODES", 6379);
      expect(result).toEqual([{ host: "::1", port: 6379 }]);
    });

    it("parses bracketed IPv6 without port (uses default)", () => {
      const result = parseNodeList("[::1]", "REDIS_CLUSTER_NODES", 6379);
      expect(result).toEqual([{ host: "::1", port: 6379 }]);
    });

    it("parses full IPv6 in brackets with port", () => {
      const result = parseNodeList(
        "[2001:db8::1]:7000",
        "REDIS_CLUSTER_NODES",
        6379,
      );
      expect(result).toEqual([{ host: "2001:db8::1", port: 7000 }]);
    });

    it("parses multiple bracketed IPv6 entries", () => {
      const result = parseNodeList(
        "[::1]:6379,[::2]:6380",
        "REDIS_CLUSTER_NODES",
        6379,
      );
      expect(result).toEqual([
        { host: "::1", port: 6379 },
        { host: "::2", port: 6380 },
      ]);
    });

    it("handles bare IPv6 address without brackets (uses default port)", () => {
      const result = parseNodeList("::1", "REDIS_CLUSTER_NODES", 6379);
      expect(result).toEqual([{ host: "::1", port: 6379 }]);
    });

    it("handles mixed IPv4, IPv6, and hostname entries", () => {
      const result = parseNodeList(
        "redis-1:6379,[::1]:6380,192.168.1.1:6381",
        "REDIS_CLUSTER_NODES",
        6379,
      );
      expect(result).toEqual([
        { host: "redis-1", port: 6379 },
        { host: "::1", port: 6380 },
        { host: "192.168.1.1", port: 6381 },
      ]);
    });
  });

  describe("error cases", () => {
    it("throws on empty string", () => {
      expect(() => parseNodeList("", "REDIS_CLUSTER_NODES", 6379)).toThrow(
        "REDIS_CLUSTER_NODES is set but contains no valid entries",
      );
    });

    it("throws on string with only commas and spaces", () => {
      expect(() => parseNodeList(" , , ", "REDIS_CLUSTER_NODES", 6379)).toThrow(
        "REDIS_CLUSTER_NODES is set but contains no valid entries",
      );
    });

    it("throws on invalid port (non-numeric)", () => {
      expect(() =>
        parseNodeList("redis-1:abc", "REDIS_CLUSTER_NODES", 6379),
      ).toThrow("port must be a number between 1 and 65535");
    });

    it("throws on port out of range (0)", () => {
      expect(() =>
        parseNodeList("redis-1:0", "REDIS_CLUSTER_NODES", 6379),
      ).toThrow("port must be a number between 1 and 65535");
    });

    it("throws on port out of range (65536)", () => {
      expect(() =>
        parseNodeList("redis-1:65536", "REDIS_CLUSTER_NODES", 6379),
      ).toThrow("port must be a number between 1 and 65535");
    });

    it("throws on missing closing bracket for IPv6", () => {
      expect(() =>
        parseNodeList("[::1:6379", "REDIS_CLUSTER_NODES", 6379),
      ).toThrow("missing closing bracket for IPv6 address");
    });

    it("throws on unexpected characters after IPv6 closing bracket", () => {
      expect(() =>
        parseNodeList("[::1]abc", "REDIS_CLUSTER_NODES", 6379),
      ).toThrow("unexpected characters after IPv6 address");
    });

    it("throws on empty host with port", () => {
      expect(() => parseNodeList(":6379", "REDIS_CLUSTER_NODES", 6379)).toThrow(
        "host is missing",
      );
    });
  });
});

describe("isRedisConfigured", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_SENTINELS;
    delete process.env.REDIS_CLUSTER_NODES;
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("returns false when no Redis env vars are set", () => {
    expect(isRedisConfigured()).toBe(false);
  });

  it("returns true when REDIS_URL is set", () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    expect(isRedisConfigured()).toBe(true);
  });

  it("returns true when REDIS_SENTINELS is set", () => {
    process.env.REDIS_SENTINELS = "sentinel-1:26379";
    expect(isRedisConfigured()).toBe(true);
  });

  it("returns true when REDIS_CLUSTER_NODES is set", () => {
    process.env.REDIS_CLUSTER_NODES = "node-1:6379,node-2:6379";
    expect(isRedisConfigured()).toBe(true);
  });

  it("returns true when multiple Redis env vars are set", () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.REDIS_SENTINELS = "sentinel-1:26379";
    process.env.REDIS_CLUSTER_NODES = "node-1:6379";
    expect(isRedisConfigured()).toBe(true);
  });
});
