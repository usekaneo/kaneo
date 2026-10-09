import { describe, expect, it } from "vite-plus/test";
import { errorCodeForStatus } from "./error-code";

describe("errorCodeForStatus", () => {
  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
    [402, "PAYMENT_REQUIRED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [408, "REQUEST_TIMEOUT"],
    [409, "CONFLICT"],
    [413, "PAYLOAD_TOO_LARGE"],
    [414, "URI_TOO_LONG"],
    [422, "UNPROCESSABLE_ENTITY"],
    [429, "RATE_LIMITED"],
    [500, "INTERNAL_SERVER_ERROR"],
    [502, "BAD_GATEWAY"],
    [503, "SERVICE_UNAVAILABLE"],
  ])("maps %i to %s", (status, code) => {
    expect(errorCodeForStatus(status)).toBe(code);
  });

  it("falls back to the numeric status for unmapped codes", () => {
    expect(errorCodeForStatus(418)).toBe("HTTP_418");
    expect(errorCodeForStatus(504)).toBe("HTTP_504");
  });
});
