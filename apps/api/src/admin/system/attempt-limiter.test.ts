import { describe, expect, it } from "vite-plus/test";
import { createAttemptLimiter } from "./attempt-limiter";

describe("createAttemptLimiter", () => {
  it("allows up to the limit inside the window, then reports when to retry", () => {
    let now = 0;
    const limiter = createAttemptLimiter({
      max: 2,
      windowMs: 60_000,
      now: () => now,
    });

    expect(limiter.take("a")).toEqual({ allowed: true });
    now = 10_000;
    expect(limiter.take("a")).toEqual({ allowed: true });
    now = 15_000;
    expect(limiter.take("a")).toEqual({
      allowed: false,
      retryAfterSeconds: 45,
    });
  });

  it("counts each key separately", () => {
    const limiter = createAttemptLimiter({ max: 1, windowMs: 60_000 });
    expect(limiter.take("a").allowed).toBe(true);
    expect(limiter.take("b").allowed).toBe(true);
    expect(limiter.take("a").allowed).toBe(false);
  });

  it("allows again once the oldest attempt leaves the window", () => {
    let now = 0;
    const limiter = createAttemptLimiter({
      max: 1,
      windowMs: 1_000,
      now: () => now,
    });
    limiter.take("a");
    now = 999;
    expect(limiter.take("a").allowed).toBe(false);
    now = 1_000;
    expect(limiter.take("a").allowed).toBe(true);
  });
});
