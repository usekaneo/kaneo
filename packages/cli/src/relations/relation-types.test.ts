import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  notLinkedPhrase,
  parseRelationType,
  perspectiveOf,
  relationHeading,
  toApiRelation,
  unlinkedPhrase,
} from "./relation-types.js";

describe("parseRelationType", () => {
  it("accepts the friendly words in any case or spacing", () => {
    expect(Result.getOrThrow(parseRelationType("blocks"))).toBe("blocks");
    expect(Result.getOrThrow(parseRelationType("Blocked by"))).toBe(
      "blocked-by",
    );
    expect(Result.getOrThrow(parseRelationType("subtask_of"))).toBe(
      "subtask-of",
    );
    expect(Result.getOrThrow(parseRelationType("related"))).toBe("relates-to");
    expect(Result.getOrThrow(parseRelationType("child-of"))).toBe("subtask-of");
  });

  it("lists the valid types for an unknown word", () => {
    const result = parseRelationType("follows");
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.message).toBe('"follows" is not a relation type.');
      expect(result.failure.hint).toBe(
        "Use one of: subtask-of, parent-of, blocks, blocked-by, relates-to.",
      );
    }
  });

  it("explains that duplicates is not supported", () => {
    const result = parseRelationType("duplicates");
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.message).toBe(
        'Kaneo has no "duplicates" relation.',
      );
      expect(result.failure.hint).toContain("relates-to is the closest match");
    }
  });
});

describe("toApiRelation", () => {
  it("makes the parent the source of a subtask relation", () => {
    expect(toApiRelation("subtask-of", "child", "parent")).toEqual({
      sourceTaskId: "parent",
      targetTaskId: "child",
      relationType: "subtask",
    });
    expect(toApiRelation("parent-of", "parent", "child")).toEqual({
      sourceTaskId: "parent",
      targetTaskId: "child",
      relationType: "subtask",
    });
  });

  it("makes the blocker the source of a blocks relation", () => {
    expect(toApiRelation("blocks", "a", "b")).toEqual({
      sourceTaskId: "a",
      targetTaskId: "b",
      relationType: "blocks",
    });
    expect(toApiRelation("blocked-by", "a", "b")).toEqual({
      sourceTaskId: "b",
      targetTaskId: "a",
      relationType: "blocks",
    });
  });

  it("maps relates-to to related", () => {
    expect(toApiRelation("relates-to", "a", "b").relationType).toBe("related");
  });
});

describe("perspectiveOf", () => {
  it("reads every API type from either side", () => {
    const relation = (relationType: string) => ({
      sourceTaskId: "a",
      relationType,
    });
    expect(perspectiveOf(relation("subtask"), "a")).toEqual({
      type: "parent-of",
      direction: "outgoing",
    });
    expect(perspectiveOf(relation("subtask"), "b")).toEqual({
      type: "subtask-of",
      direction: "incoming",
    });
    expect(perspectiveOf(relation("blocks"), "a").type).toBe("blocks");
    expect(perspectiveOf(relation("blocks"), "b").type).toBe("blocked-by");
    expect(perspectiveOf(relation("related"), "b")).toEqual({
      type: "relates-to",
      direction: "incoming",
    });
    expect(perspectiveOf(relation("duplicates"), "a").type).toBe("duplicates");
  });
});

describe("labels", () => {
  it("names groups and unknown types", () => {
    expect(relationHeading("blocked-by")).toBe("Blocked by");
    expect(relationHeading("relates-to")).toBe("Related");
    expect(relationHeading("duplicates")).toBe("Duplicates");
  });

  it("has no unlink phrase for unknown types", () => {
    expect(unlinkedPhrase("blocks")).toBe("no longer blocks");
    expect(unlinkedPhrase("duplicates")).toBeNull();
  });

  it("phrases a missing relation", () => {
    expect(notLinkedPhrase("blocks")).toBe("does not block");
    expect(notLinkedPhrase("subtask-of")).toBe("is not a subtask of");
  });
});
