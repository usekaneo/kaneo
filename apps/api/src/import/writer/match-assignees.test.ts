import { describe, expect, it } from "vite-plus/test";
import {
  createAssigneeMatcher,
  unmatchedAssigneeWarning,
} from "./match-assignees";

const members = [
  { id: "u-ana", name: "Ana Lima", email: "Ana@Example.com" },
  { id: "u-bo", name: "Bo", email: "bo@example.com" },
  { id: "u-sam-1", name: "Sam", email: "sam.one@example.com" },
  { id: "u-sam-2", name: "sam", email: "sam.two@example.com" },
];

describe("createAssigneeMatcher", () => {
  it("matches emails case-insensitively", () => {
    const matcher = createAssigneeMatcher(members);
    expect(matcher.match({ email: " ana@example.COM ", name: "A" })).toBe(
      "u-ana",
    );
    expect(matcher.warning()).toBeNull();
  });

  it("trusts a given email over the name", () => {
    const matcher = createAssigneeMatcher(members);
    expect(
      matcher.match({ email: "ana@elsewhere.com", name: "Ana Lima" }),
    ).toBe(null);
  });

  it("falls back to a unique, exact name when the source hides emails", () => {
    const matcher = createAssigneeMatcher(members);
    expect(matcher.match({ name: "  ana lima " })).toBe("u-ana");
    expect(matcher.match({ name: "Ana" })).toBeNull();
    expect(matcher.match({ name: "Sam" })).toBeNull();
  });

  it("ignores tasks without an assignee", () => {
    const matcher = createAssigneeMatcher(members);
    expect(matcher.match(undefined)).toBeNull();
    expect(matcher.match({ name: " " })).toBeNull();
    expect(matcher.warning()).toBeNull();
  });

  it("summarises the people it could not match", () => {
    const matcher = createAssigneeMatcher(members);
    matcher.match({ name: "Cy", email: "cy@example.com" });
    matcher.match({ name: "Cy", email: "cy@example.com" });
    matcher.match({ email: "dee@example.com" });

    expect(matcher.warning()).toBe(
      "3 tasks were assigned to people who are not members of this workspace (Cy, dee@example.com). Invite them, then assign the tasks.",
    );
  });
});

describe("unmatchedAssigneeWarning", () => {
  it("uses the singular for one task", () => {
    expect(unmatchedAssigneeWarning(1, ["Ana"])).toBe(
      "1 task was assigned to someone who is not a member of this workspace (Ana). Invite them, then assign the task.",
    );
  });

  it("lists at most five names", () => {
    expect(
      unmatchedAssigneeWarning(7, ["A", "B", "C", "D", "E", "F", "G"]),
    ).toBe(
      "7 tasks were assigned to people who are not members of this workspace (A, B, C, D, E, and 2 more). Invite them, then assign the tasks.",
    );
  });
});
