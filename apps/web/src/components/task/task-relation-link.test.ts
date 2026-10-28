import { describe, expect, it } from "vite-plus/test";
import {
  buildRelationLink,
  findParentRelation,
  unpickableTaskIds,
} from "./task-relation-link";

const relations = [
  {
    id: "parent-link",
    sourceTaskId: "parent",
    targetTaskId: "task",
    relationType: "subtask",
  },
  {
    id: "child-link",
    sourceTaskId: "task",
    targetTaskId: "child",
    relationType: "subtask",
  },
  {
    id: "related-link",
    sourceTaskId: "task",
    targetTaskId: "related",
    relationType: "related",
  },
];

describe("buildRelationLink", () => {
  it("points blocking and related links from the open task", () => {
    expect(buildRelationLink("blocks", "task", "picked")).toEqual({
      sourceTaskId: "task",
      targetTaskId: "picked",
      relationType: "blocks",
    });
    expect(buildRelationLink("related", "task", "picked")).toEqual({
      sourceTaskId: "task",
      targetTaskId: "picked",
      relationType: "related",
    });
  });

  it("reverses blocked by and parent links", () => {
    expect(buildRelationLink("blockedBy", "task", "picked")).toEqual({
      sourceTaskId: "picked",
      targetTaskId: "task",
      relationType: "blocks",
    });
    expect(buildRelationLink("parent", "task", "picked")).toEqual({
      sourceTaskId: "picked",
      targetTaskId: "task",
      relationType: "subtask",
    });
  });
});

describe("findParentRelation", () => {
  it("finds the subtask link that targets the task", () => {
    expect(findParentRelation("task", relations)?.id).toBe("parent-link");
    expect(findParentRelation("child", relations)?.id).toBe("child-link");
    expect(findParentRelation("related", relations)).toBeUndefined();
  });
});

describe("unpickableTaskIds", () => {
  it("hides the task and its existing links", () => {
    expect([...unpickableTaskIds("related", "task", relations)].sort()).toEqual(
      ["related", "task"],
    );
  });

  it("hides the current parent and subtasks when picking a parent", () => {
    expect([...unpickableTaskIds("parent", "task", relations)].sort()).toEqual([
      "child",
      "parent",
      "task",
    ]);
  });
});
