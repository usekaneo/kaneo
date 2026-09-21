import { describe, expect, it } from "vitest";
import { resolveAuthSecret } from "../../apps/api/src/utils/auth-secret";

const valid = "a".repeat(32);

describe("AUTH_SECRET resolution", () => {
  it.each([undefined, ""])(
    "refuses to start when AUTH_SECRET is %p",
    (value) => {
      expect(() => resolveAuthSecret(value)).toThrow(/AUTH_SECRET is not set/);
    },
  );

  it("never returns Better Auth's default secret", () => {
    expect(() =>
      resolveAuthSecret("better-auth-secret-12345678901234567890"),
    ).not.toThrow();
    expect(resolveAuthSecret(valid)).not.toBe(
      "better-auth-secret-12345678901234567890",
    );
  });

  it("rejects a secret shorter than 32 characters", () => {
    expect(() => resolveAuthSecret("a".repeat(31))).toThrow(/less than 32/);
  });

  it("accepts a secret of exactly 32 characters", () => {
    expect(resolveAuthSecret(valid)).toBe(valid);
  });
});
