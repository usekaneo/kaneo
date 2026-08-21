import { describe, expect, it } from "vitest";
import { parseApiError } from "./error-handler";

describe("parseApiError", () => {
  it("returns a generic message key for unknown Error instances instead of leaking error.message", () => {
    const internalMessage =
      "Cannot read properties of undefined (reading 'id') at TaskList";
    const result = parseApiError(new Error(internalMessage));

    expect(result.type).toBe("unknown");
    expect(result.message).toBe("common:error.messages.unknown");
    expect(result.message).not.toContain(internalMessage);
    // originalError is preserved so Sentry still sees the real cause.
    expect(result.originalError?.message).toBe(internalMessage);
  });

  it("returns a generic message key for non-Error values", () => {
    const result = parseApiError("something bad happened");
    expect(result.type).toBe("unknown");
    expect(result.message).toBe("common:error.messages.unknown");
  });

  it("still returns a CORS-specific message key for matching errors", () => {
    const result = parseApiError(new Error("Failed to fetch: CORS blocked"));
    expect(result.type).toBe("cors");
    expect(result.message).toBe("common:error.messages.cors");
  });

  it("classifies Safari's 'Load failed' as a network error, not CORS", () => {
    const originalMessage = "TypeError: Load failed";
    const error = new Error(originalMessage);

    const result = parseApiError(error);

    expect(result.type).toBe("network");
    expect(result.message).toBe("common:error.messages.network");
    expect(result.originalError).toBe(error);
    expect(result.originalError?.message).toBe(originalMessage);
  });
});
