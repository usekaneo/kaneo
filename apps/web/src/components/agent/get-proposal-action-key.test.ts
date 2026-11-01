import { describe, expect, it } from "vite-plus/test";
import { getProposalActionKey } from "./get-proposal-action-key";

describe("getProposalActionKey", () => {
  it("labels comments, creations, and single-field updates", () => {
    expect(
      getProposalActionKey({
        kind: "comment",
        taskId: "t",
        taskTitle: "Fix",
        body: "Hi",
        changes: [],
      }),
    ).toBe("comment");
    expect(
      getProposalActionKey({
        kind: "create",
        taskId: null,
        taskTitle: "New",
        changes: [],
      }),
    ).toBe("create");
    expect(
      getProposalActionKey({
        kind: "update",
        taskId: "t",
        taskTitle: "Fix",
        changes: [{ field: "assignee", from: "a", to: "b" }],
      }),
    ).toBe("reassign");
  });
});
