import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Label } from "../api/labels.js";
import { labelForRemoval } from "./label-for-removal.js";

function label(id: string, name: string, taskId: string | null): Label {
  return { id, name, color: "red", taskId, workspaceId: "w1" };
}

describe("labelForRemoval", () => {
  it("prefers the workspace label over task copies", () => {
    const labels = [label("t1", "Bug", "task-1"), label("w1", "Bug", null)];
    expect(Result.getOrThrow(labelForRemoval(labels, "bug")).id).toBe("w1");
  });

  it("falls back to a task copy when the workspace label is gone", () => {
    expect(
      Result.getOrThrow(labelForRemoval([label("t1", "Old", "task-1")], "old"))
        .id,
    ).toBe("t1");
  });

  it("accepts a label id and fails for unknown names", () => {
    expect(
      Result.getOrThrow(labelForRemoval([label("t1", "Old", "task-1")], "t1"))
        .name,
    ).toBe("Old");
    expect(Result.isFailure(labelForRemoval([], "Bug"))).toBe(true);
  });
});
