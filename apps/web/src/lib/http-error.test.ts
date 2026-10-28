import i18n from "i18next";
import { describe, expect, it, vi } from "vite-plus/test";
import { HttpError, isUnauthorizedError } from "./http-error";

vi.mock("i18next", async (importOriginal) => {
  const { default: i18next } = await importOriginal<typeof import("i18next")>();
  const instance = i18next.createInstance();
  await instance.init({ lng: "en-US", resources: {} });
  return { default: instance };
});

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
    expect(
      isUnauthorizedError(
        new HttpError(401, "Unauthorized", { code: "UNAUTHORIZED" }),
      ),
    ).toBe(true);
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
    new HttpError(401, "Invalid GitLab token or unauthorized.", {
      code: "INTEGRATION_AUTH_FAILED",
    }),
    { name: "HttpError", status: 401, code: "INVALID_EMAIL_OR_PASSWORD" },
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

  it("falls back to the server error message for an empty 5xx body", async () => {
    const error = await HttpError.fromResponse(
      new Response(null, { status: 502 }),
    );

    expect(error.status).toBe(502);
    expect(error.message).toBe("Server error. Please try again later.");
    expect(error.code).toBeUndefined();
  });

  it("treats an unreadable body as empty", async () => {
    const error = await HttpError.fromResponse({
      status: 500,
      text: () => Promise.reject(new Error("aborted")),
    });

    expect(error.status).toBe(500);
    expect(error.message).toBe("Server error. Please try again later.");
  });

  it("falls back to the unknown error message for a blank 4xx body", async () => {
    const error = await HttpError.fromResponse(
      new Response("  \n", { status: 404 }),
    );

    expect(error.message).toBe("An unexpected error occurred.");
  });

  it("keeps the code when the JSON message is blank", async () => {
    const error = await HttpError.fromResponse(
      Response.json({ message: "", code: "CONFLICT" }, { status: 409 }),
    );

    expect(error.message).toBe("An unexpected error occurred.");
    expect(error.code).toBe("CONFLICT");
  });

  it("uses the English fallback before translations load", async () => {
    expect(i18n.hasResourceBundle("en-US", "common")).toBe(false);

    const serverError = await HttpError.fromResponse(
      new Response(null, { status: 500 }),
    );
    const unknownError = await HttpError.fromResponse(
      new Response(null, { status: 400 }),
    );

    expect(serverError.message).toBe("Server error. Please try again later.");
    expect(unknownError.message).toBe("An unexpected error occurred.");
  });

  it("uses the loaded translation once resources are available", async () => {
    i18n.addResourceBundle("en-US", "common", {
      error: { messages: { server: "Translated server error" } },
    });
    try {
      const error = await HttpError.fromResponse(
        new Response(null, { status: 503 }),
      );

      expect(error.message).toBe("Translated server error");
    } finally {
      i18n.removeResourceBundle("en-US", "common");
    }
  });
});
