import { describe, expect, it } from "vite-plus/test";
import type { SearchResult, TaskRelation } from "@/lib/api/types";
import { linkCandidates, parentRelation, relationLink } from "./relation-link";

const relations: TaskRelation[] = [
  {
    id: "r1",
    sourceTaskId: "parent",
    targetTaskId: "t1",
    relationType: "subtask",
  },
  {
    id: "r2",
    sourceTaskId: "t1",
    targetTaskId: "child",
    relationType: "subtask",
  },
  {
    id: "r3",
    sourceTaskId: "t1",
    targetTaskId: "other",
    relationType: "related",
  },
];

function result(id: string, projectId = "p1"): SearchResult {
  return { id, type: "task", title: id, projectId };
}

describe("parentRelation", () => {
  it("finds the link that names the task's parent", () => {
    expect(parentRelation("t1", relations)?.id).toBe("r1");
    expect(parentRelation("child", relations)?.id).toBe("r2");
    expect(parentRelation("other", relations)).toBeUndefined();
  });
});

describe("relationLink", () => {
  it("links related and blocking tasks from this task", () => {
    expect(relationLink("blocks", "t1", "x", relations)).toEqual({
      sourceTaskId: "t1",
      targetTaskId: "x",
      relationType: "blocks",
    });
  });

  it("makes the picked task the parent and replaces the old parent", () => {
    expect(relationLink("parent", "t1", "x", relations)).toEqual({
      sourceTaskId: "x",
      targetTaskId: "t1",
      relationType: "subtask",
      replaces: "r1",
    });
    expect(relationLink("parent", "other", "x", relations).replaces).toBe(
      undefined,
    );
  });
});

describe("linkCandidates", () => {
  const results = [
    result("t1"),
    result("parent"),
    result("child"),
    result("other"),
    result("elsewhere", "p2"),
  ];

  it("offers every other task for plain links", () => {
    expect(
      linkCandidates(results, "related", "t1", "p1", relations).map(
        (r) => r.id,
      ),
    ).toEqual(["parent", "child", "other", "elsewhere"]);
  });

  it("offers only same-project tasks that don't make a loop as parents", () => {
    expect(
      linkCandidates(results, "parent", "t1", "p1", relations).map((r) => r.id),
    ).toEqual(["other"]);
  });
});
