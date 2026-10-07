import { describe, expect, it } from "vite-plus/test";
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

describe("HttpError.fromResponse", () => {
  it("parses the JSON error shape", async () => {
    const error = await HttpError.fromResponse(
      new Response(
        JSON.stringify({
          message: "Insufficient permissions",
          code: "MISSING_PERMISSION",
          missingPermissions: ["task:update"],
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    );

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(403);
    expect(error.message).toBe("Insufficient permissions");
    expect(error.code).toBe("MISSING_PERMISSION");
    expect(error.missingPermissions).toEqual(["task:update"]);
    expect(error.issues).toBeUndefined();
  });

  it("keeps validation issues", async () => {
    const error = await HttpError.fromResponse(
      new Response(
        JSON.stringify({
          message: "title: Required",
          code: "VALIDATION_ERROR",
          issues: [
            { path: "body.title", message: "Required" },
            { path: "body.priority", message: "Invalid option" },
          ],
        }),
        { status: 400 },
      ),
    );

    expect(error.message).toBe("title: Required");
    expect(error.issues).toHaveLength(2);
  });

  it("falls back to a text body from an older API", async () => {
    const error = await HttpError.fromResponse(
      new Response("Task not found", { status: 404 }),
    );

    expect(error.status).toBe(404);
    expect(error.message).toBe("Task not found");
    expect(error.code).toBeUndefined();
  });

  it("keeps an empty message for an empty body", async () => {
    const error = await HttpError.fromResponse(
      new Response(null, { status: 502 }),
    );

    expect(error.status).toBe(502);
    expect(error.message).toBe("");
    expect(error.code).toBeUndefined();
  });

  it("treats an unreadable body as empty", async () => {
    const error = await HttpError.fromResponse({
      status: 500,
      text: () => Promise.reject(new Error("aborted")),
    });

    expect(error.status).toBe(500);
    expect(error.message).toBe("");
  });
});
