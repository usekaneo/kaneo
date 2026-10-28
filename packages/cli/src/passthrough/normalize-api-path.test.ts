import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { normalizeApiPath } from "./normalize-api-path.js";

function target(input: string) {
  const parsed = normalizeApiPath(input);
  return Result.isSuccess(parsed) ? parsed.success : parsed.failure.message;
}

describe("normalizeApiPath", () => {
  it("accepts paths with or without the /api prefix", () => {
    expect(target("/task/assigned")).toEqual({
      path: "/api/task/assigned",
      query: {},
    });
    expect(target("/api/task/assigned")).toEqual({
      path: "/api/task/assigned",
      query: {},
    });
    expect(target("user/me")).toEqual({ path: "/api/user/me", query: {} });
    expect(target("/apiary")).toEqual({ path: "/api/apiary", query: {} });
  });

  it("moves an inline query string into query parameters", () => {
    expect(target("/project?workspaceId=ws_1&x=a%20b")).toEqual({
      path: "/api/project",
      query: { workspaceId: "ws_1", x: "a b" },
    });
  });

  it("rejects full URLs", () => {
    expect(target("https://cloud.kaneo.app/api/user/me")).toBe(
      "https://cloud.kaneo.app/api/user/me is a full URL.",
    );
  });
});
