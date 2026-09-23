import { afterEach, describe, expect, it, vi } from "vitest";
import { assertWebSocketOrigin } from "../../../apps/api/src/ws/security";

afterEach(() => vi.unstubAllEnvs());

describe("WebSocket origin configuration", () => {
  it("fails closed in production without configured origins, including wildcards", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KANEO_CLIENT_URL", "");
    vi.stubEnv("KANEO_API_URL", "");
    vi.stubEnv(
      "CORS_ORIGINS",
      "*,null,invalid,https://user:password@example.test",
    );
    for (const origin of [
      "null",
      "http://localhost:5173",
      "https://example.test",
    ]) {
      expect(() => assertWebSocketOrigin(new Headers({ origin }))).toThrow(
        "origin is not allowed",
      );
    }
  });
  it("uses configured URL origins, never request Host or forwarding headers", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KANEO_CLIENT_URL", "https://app.example.test/");
    vi.stubEnv("KANEO_API_URL", "https://api.example.test/api");
    vi.stubEnv(
      "CORS_ORIGINS",
      "https://extra.example.test, https://other.example.test",
    );
    for (const origin of [
      "https://app.example.test",
      "https://api.example.test",
      "https://extra.example.test",
      "https://other.example.test",
    ]) {
      expect(() =>
        assertWebSocketOrigin(new Headers({ origin })),
      ).not.toThrow();
    }
    expect(() =>
      assertWebSocketOrigin(
        new Headers({
          origin: "https://evil.example.test",
          host: "evil.example.test",
          "x-forwarded-host": "evil.example.test",
          authorization: "Bearer native-token",
        }),
      ),
    ).toThrow("origin is not allowed");
  });
});
