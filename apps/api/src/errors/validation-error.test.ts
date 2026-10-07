import { describe, expect, it } from "vite-plus/test";
import { ApiError } from "./api-error";
import {
  validationError,
  validationHook,
  validationHookWithMessage,
} from "./validation-error";

const issues = [
  { path: ["title"], message: "Required" },
  { path: ["limit"], message: "Too big" },
];

describe("validationHook", () => {
  it("lets successful results through", () => {
    expect(validationHook({ success: true, target: "json" })).toBeUndefined();
  });

  it("throws a VALIDATION_ERROR listing every issue", () => {
    let thrown: unknown;
    try {
      validationHook({ success: false, target: "json", error: { issues } });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown).toMatchObject({
      status: 400,
      message: "title: Required",
      code: "VALIDATION_ERROR",
      issues: [
        { path: "body.title", message: "Required" },
        { path: "body.limit", message: "Too big" },
      ],
    });
  });

  it("keeps a fixed message while reporting the issues", () => {
    expect(() =>
      validationHookWithMessage("Invalid description cursor")({
        success: false,
        target: "query",
        error: { issues },
      }),
    ).toThrow("Invalid description cursor");
    expect(validationError(issues, "query", "Fixed")).toMatchObject({
      message: "Fixed",
      issues: [
        { path: "query.title", message: "Required" },
        { path: "query.limit", message: "Too big" },
      ],
    });
  });
});
