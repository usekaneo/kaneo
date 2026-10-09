import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { checkFound, checkSameWorkspace } from "./preflight.js";

describe("checkFound", () => {
  it("changes nothing when any task is unknown and names them all", () => {
    const result = checkFound([
      { reference: "KAN-1", task: { id: "a" } },
      { reference: "KAN-98", task: null },
      { reference: "KAN-99", task: null },
    ]);
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "Tasks KAN-98 and KAN-99 were not found, so nothing was changed.",
    );
  });

  it("uses the singular for one unknown task", () => {
    const result = checkFound([{ reference: "KAN-98", task: null }]);
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "Task KAN-98 was not found, so nothing was changed.",
    );
  });

  it("drops tasks named twice, keeping the order", () => {
    expect(
      Result.getOrThrow(
        checkFound([
          { reference: "KAN-2", task: { id: "b" } },
          { reference: "KAN-1", task: { id: "a" } },
          { reference: "b", task: { id: "b" } },
        ]),
      ).map((task) => task.id),
    ).toEqual(["b", "a"]);
  });
});

describe("checkSameWorkspace", () => {
  it("returns the shared workspace", () => {
    expect(
      Result.getOrThrow(
        checkSameWorkspace([{ workspaceId: "w1" }, { workspaceId: "w1" }]),
      ),
    ).toBe("w1");
  });

  it("refuses tasks from two workspaces, which the API rejects", () => {
    expect(
      Result.isFailure(
        checkSameWorkspace([{ workspaceId: "w1" }, { workspaceId: "w2" }]),
      ),
    ).toBe(true);
  });
});
