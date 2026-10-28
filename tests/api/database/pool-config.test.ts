import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { resolveDatabasePoolMax } from "../../../apps/api/src/database/pool-config";

describe("pool-config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults the pool size to 10 when DATABASE_POOL_MAX is unset or empty", () => {
    vi.stubEnv("DATABASE_POOL_MAX", undefined);
    expect(resolveDatabasePoolMax()).toBe(10);

    vi.stubEnv("DATABASE_POOL_MAX", " ");
    expect(resolveDatabasePoolMax()).toBe(10);
  });

  it("uses DATABASE_POOL_MAX as the pool size", () => {
    vi.stubEnv("DATABASE_POOL_MAX", "2");
    expect(resolveDatabasePoolMax()).toBe(2);

    vi.stubEnv("DATABASE_POOL_MAX", " 25 ");
    expect(resolveDatabasePoolMax()).toBe(25);
  });

  it("rejects a DATABASE_POOL_MAX that is not an integer of at least 2", () => {
    for (const value of [
      "1",
      "0",
      "-1",
      "2.5",
      "1e1",
      "ten",
      "05",
      "9007199254740993",
      "9".repeat(309),
    ]) {
      vi.stubEnv("DATABASE_POOL_MAX", value);
      expect(() => resolveDatabasePoolMax()).toThrow(
        "DATABASE_POOL_MAX must be an integer of at least 2",
      );
    }
  });
});
