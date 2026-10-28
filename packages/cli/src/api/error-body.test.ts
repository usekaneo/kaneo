import { describe, expect, it } from "vite-plus/test";
import { parseErrorBody, parseRetryAfter } from "./error-body.js";

describe("parseErrorBody", () => {
  it("reads the JSON error shape", () => {
    expect(
      parseErrorBody(
        '{"message":"Insufficient permissions","code":"MISSING_PERMISSION","missingPermissions":["task:delete"]}',
        403,
      ),
    ).toEqual({
      message: "Insufficient permissions",
      code: "MISSING_PERMISSION",
      missingPermissions: ["task:delete"],
    });
  });

  it("falls back to plain text bodies from older servers", () => {
    expect(parseErrorBody("Task not found", 404)).toEqual({
      message: "Task not found",
      code: null,
      missingPermissions: [],
    });
    expect(parseErrorBody("", 502).message).toBe("HTTP 502");
  });

  it("reads OAuth style errors", () => {
    expect(parseErrorBody('{"error":"invalid_token"}', 401).message).toBe(
      "invalid_token",
    );
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds and dates", () => {
    expect(parseRetryAfter("7", 0)).toBe(7);
    expect(parseRetryAfter(new Date(30_000).toUTCString(), 0)).toBe(30);
    expect(parseRetryAfter(undefined, 0)).toBeNull();
    expect(parseRetryAfter("soon", 0)).toBeNull();
  });
});
