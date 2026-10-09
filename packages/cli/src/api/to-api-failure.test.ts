import { describe, expect, it } from "vite-plus/test";
import { type FailedResponse, toApiFailure } from "./to-api-failure.js";

function failed(
  status: number,
  overrides: Partial<FailedResponse> = {},
): FailedResponse {
  return {
    status,
    body: { message: "boom", code: null, missingPermissions: [] },
    retryAfterSeconds: null,
    tokenSource: "profile",
    apiUrl: "https://cloud.kaneo.app",
    ...overrides,
  };
}

describe("toApiFailure", () => {
  it("separates an expired login from a rejected key", () => {
    expect(toApiFailure(failed(401))._tag).toBe("SessionExpired");
    expect(toApiFailure(failed(401, { tokenSource: "env" }))).toMatchObject({
      _tag: "CredentialsRejected",
      source: "env",
    });
  });

  it("recognizes session-only routes", () => {
    expect(
      toApiFailure(
        failed(403, {
          body: {
            message: "A user session is required",
            code: null,
            missingPermissions: [],
          },
        }),
      )._tag,
    ).toBe("SessionRequired");
    expect(
      toApiFailure(
        failed(403, {
          body: {
            message: "Nope",
            code: "SESSION_REQUIRED",
            missingPermissions: [],
          },
        }),
      )._tag,
    ).toBe("SessionRequired");
  });

  it("keeps missing permissions", () => {
    expect(
      toApiFailure(
        failed(403, {
          body: {
            message: "Denied",
            code: "MISSING_PERMISSION",
            missingPermissions: ["task:delete"],
          },
        }),
      ),
    ).toMatchObject({
      _tag: "PermissionDenied",
      missingPermissions: ["task:delete"],
    });
  });

  it("maps the remaining statuses", () => {
    expect(toApiFailure(failed(404))._tag).toBe("NotFound");
    expect(toApiFailure(failed(409))._tag).toBe("Conflict");
    expect(toApiFailure(failed(400))._tag).toBe("InvalidRequest");
    expect(toApiFailure(failed(429, { retryAfterSeconds: 12 }))).toMatchObject({
      _tag: "RateLimited",
      retryAfterSeconds: 12,
    });
    expect(toApiFailure(failed(503))._tag).toBe("ServerError");
  });
});
