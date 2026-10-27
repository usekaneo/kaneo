import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "./http-error";
import { isWorkspaceArchivedError } from "./is-workspace-archived-error";

describe("isWorkspaceArchivedError", () => {
  it("recognizes the archived workspace code", () => {
    expect(
      isWorkspaceArchivedError(
        new HttpError(403, "Archived", { code: "WORKSPACE_ARCHIVED" }),
      ),
    ).toBe(true);
  });

  it("ignores other errors", () => {
    expect(
      isWorkspaceArchivedError(
        new HttpError(403, "No", { code: "MISSING_PERMISSION" }),
      ),
    ).toBe(false);
    expect(isWorkspaceArchivedError(new Error("Archived"))).toBe(false);
    expect(isWorkspaceArchivedError(null)).toBe(false);
  });
});
