import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { getAgentErrorKey } from "./get-agent-error-key";

describe("getAgentErrorKey", () => {
  it("maps known agent statuses to specific copy", () => {
    expect(getAgentErrorKey(new HttpError(429, "{}"))).toBe(
      "agent:errors.rateLimited",
    );
    expect(getAgentErrorKey(new HttpError(409, "{}"))).toBe(
      "agent:errors.conflict",
    );
    expect(getAgentErrorKey(new HttpError(503, "{}"))).toBe(
      "agent:errors.unavailable",
    );
  });

  it("falls back to generic copy for other failures", () => {
    expect(getAgentErrorKey(new Error("Failed to fetch"))).toBe(
      "agent:errors.generic",
    );
  });
});
