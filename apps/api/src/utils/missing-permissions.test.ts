import { describe, expect, it } from "vite-plus/test";
import { missingPermissions } from "./missing-permissions";

describe("missingPermissions", () => {
  it("returns nothing when every required action is granted", () => {
    expect(
      missingPermissions(
        { task: ["read", "update"], project: ["read"] },
        { task: ["update"], project: ["read"] },
      ),
    ).toEqual([]);
  });

  it("lists each required action the statements lack", () => {
    expect(
      missingPermissions(
        { task: ["read"] },
        { task: ["read", "update", "delete"], project: ["create"] },
      ),
    ).toEqual(["task:update", "task:delete", "project:create"]);
  });

  it("treats missing statements as granting nothing", () => {
    expect(missingPermissions(null, { task: ["create"] })).toEqual([
      "task:create",
    ]);
  });

  it("ignores grants the route does not require", () => {
    expect(
      missingPermissions(
        { workspace: ["delete"], task: ["create"] },
        { task: ["create"] },
      ),
    ).toEqual([]);
  });
});
