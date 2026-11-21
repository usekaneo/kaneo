import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { logTangledFailure } from "./log-failure";

afterEach(() => vi.restoreAllMocks());

describe("Tangled failure diagnostics", () => {
  it.each([
    ["23505", "database_constraint"],
    ["42P01", "database_schema"],
    ["57014", "database_timeout"],
    ["08006", "database_connection"],
    ["private-code", "unexpected"],
  ])(
    "classifies allowlisted code %s without exposing the error",
    (code, expected) => {
      const cause = Object.assign(new Error("private payload"), { code });
      const error = new Error("private connection string", { cause });
      const logs = vi.spyOn(console, "error").mockImplementation(() => {});

      logTangledFailure("webhook", error);

      expect(logs).toHaveBeenCalledWith("Tangled processing failed", {
        stage: "webhook",
        category: expected,
      });
      expect(JSON.stringify(logs.mock.calls)).not.toContain("private");
    },
  );

  it("classifies the Tangled read deadline as a timeout", () => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});

    logTangledFailure(
      "repository_lookup",
      new Error("Tangled API request timed out"),
    );

    expect(logs).toHaveBeenCalledWith("Tangled processing failed", {
      stage: "repository_lookup",
      category: "timeout",
    });
  });

  it("classifies timeouts without exposing their message", () => {
    const error = new Error("private destination");
    error.name = "TimeoutError";
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});

    logTangledFailure("branch_lookup", error);

    expect(logs).toHaveBeenCalledWith("Tangled processing failed", {
      stage: "branch_lookup",
      category: "timeout",
    });
    expect(JSON.stringify(logs.mock.calls)).not.toContain(
      "private destination",
    );
  });
});
