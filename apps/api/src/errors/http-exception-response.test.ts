import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vite-plus/test";
import { ApiError } from "./api-error";
import { httpExceptionResponse } from "./http-exception-response";

describe("httpExceptionResponse", () => {
  it("turns a plain HTTPException into JSON with a derived code", async () => {
    const response = await httpExceptionResponse(
      new HTTPException(404, { message: "Task not found" }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      message: "Task not found",
      code: "NOT_FOUND",
    });
  });

  it("keeps the specific code and details of an ApiError", async () => {
    const response = await httpExceptionResponse(
      new ApiError(403, {
        message: "Insufficient permissions",
        code: "MISSING_PERMISSION",
        missingPermissions: ["task:update"],
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      message: "Insufficient permissions",
      code: "MISSING_PERMISSION",
      missingPermissions: ["task:update"],
    });
  });

  it("converts a text response body and keeps its headers", async () => {
    const response = await httpExceptionResponse(
      new HTTPException(429, {
        res: new Response("Label deletion is busy; retry this request", {
          status: 429,
          headers: { "Retry-After": "1" },
        }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("1");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      message: "Label deletion is busy; retry this request",
      code: "RATE_LIMITED",
    });
  });

  it("standardizes a JSON response that carries a message", async () => {
    const response = await httpExceptionResponse(
      new HTTPException(400, {
        res: Response.json(
          { message: "Use the comment endpoint" },
          { status: 400 },
        ),
      }),
    );

    expect(await response.json()).toEqual({
      message: "Use the comment endpoint",
      code: "BAD_REQUEST",
    });
  });

  it("passes an OAuth error response through untouched", async () => {
    const original = Response.json(
      { error: "temporarily_unavailable", error_description: "Retry later" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
    const response = await httpExceptionResponse(
      new HTTPException(429, { res: original }),
    );

    expect(response).toBe(original);
    expect(await response.json()).toEqual({
      error: "temporarily_unavailable",
      error_description: "Retry later",
    });
  });

  it("falls back to a generic message for an empty body", async () => {
    const response = await httpExceptionResponse(
      new HTTPException(418, { res: new Response(null, { status: 418 }) }),
    );

    expect(await response.json()).toEqual({
      message: "Request failed",
      code: "HTTP_418",
    });
  });
});
