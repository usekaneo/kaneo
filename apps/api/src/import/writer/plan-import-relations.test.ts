import type { ImportedRelation } from "@kaneo/importers";
import { describe, expect, it } from "vite-plus/test";
import { planImportRelations } from "./plan-import-relations";

const taskIds = new Map([
  ["a", "task-a"],
  ["b", "task-b"],
  ["c", "task-c"],
]);

describe("planImportRelations", () => {
  it("maps keys to the new task ids", () => {
    expect(
      planImportRelations(
        [
          { sourceKey: "a", targetKey: "b", type: "subtask" },
          { sourceKey: "b", targetKey: "c", type: "blocks" },
        ],
        taskIds,
      ),
    ).toEqual([
      {
        sourceTaskId: "task-a",
        targetTaskId: "task-b",
        relationType: "subtask",
      },
      {
        sourceTaskId: "task-b",
        targetTaskId: "task-c",
        relationType: "blocks",
      },
    ]);
  });

  it("skips self relations, unknown tasks and duplicates in either direction", () => {
    expect(
      planImportRelations(
        [
          { sourceKey: "a", targetKey: "a", type: "related" },
          { sourceKey: "a", targetKey: "missing", type: "related" },
          { sourceKey: "a", targetKey: "b", type: "related" },
          { sourceKey: "b", targetKey: "a", type: "related" },
          { sourceKey: "a", targetKey: "b", type: "blocks" },
          {
            sourceKey: "a",
            targetKey: "b",
            type: "duplicates",
          } as unknown as ImportedRelation,
        ],
        taskIds,
      ),
    ).toEqual([
      {
        sourceTaskId: "task-a",
        targetTaskId: "task-b",
        relationType: "related",
      },
      {
        sourceTaskId: "task-a",
        targetTaskId: "task-b",
        relationType: "blocks",
      },
    ]);
  });
});
