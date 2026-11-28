import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parsePackageName } from "./package-name.js";

function failure(input: string) {
  const result = parsePackageName(input);
  expect(Result.isFailure(result)).toBe(true);
  return Result.isFailure(result) ? result.failure : null;
}

describe("parsePackageName", () => {
  it("accepts plain and scoped names", () => {
    expect(parsePackageName(" kaneo-plugin-task-progress ")).toEqual(
      Result.succeed("kaneo-plugin-task-progress"),
    );
    expect(parsePackageName("@acme/kaneo-reports")).toEqual(
      Result.succeed("@acme/kaneo-reports"),
    );
  });

  it("asks for the name without a version", () => {
    expect(failure("kaneo-plugin-x@1.2.0")).toMatchObject({
      _tag: "InvalidArgument",
      message:
        "kaneo plugin add picks the version for you. Run kaneo plugin add kaneo-plugin-x without a version.",
    });
    expect(failure("@acme/reports@latest")?.message).toContain(
      "Run kaneo plugin add @acme/reports without a version.",
    );
  });

  it("rejects invalid names", () => {
    expect(failure("Not Valid")?.message).toBe(
      '"Not Valid" is not a valid npm package name.',
    );
    expect(failure("../local")?.message).toContain(
      "is not a valid npm package name",
    );
  });
});
