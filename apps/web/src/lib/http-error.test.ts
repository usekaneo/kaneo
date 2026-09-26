import { describe, expect, it } from "vitest";
import { HttpError, isUnauthorizedError } from "./http-error";

describe("isUnauthorizedError", () => {
  it("recognizes a 401 HttpError with a different prototype", () => {
    const error = Object.assign(new Error("Session expired"), {
      name: "HttpError",
      status: 401,
    });
    expect(error).not.toBeInstanceOf(HttpError);
    expect(isUnauthorizedError(error)).toBe(true);
    expect(isUnauthorizedError(new HttpError(401, "Session expired"))).toBe(
      true,
    );
  });

  it.each([
    null,
    undefined,
    "401",
    new Error("401"),
    new HttpError(403, "Forbidden"),
    { name: "HttpError", status: "401" },
    { name: "HttpError", status: 500 },
    { name: "TypeError", status: 401 },
    { status: 401 },
  ])("rejects other errors: %j", (error) => {
    expect(isUnauthorizedError(error)).toBe(false);
  });
});
