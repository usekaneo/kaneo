import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { pickLabels } from "./pick-labels.js";
import { taskLabel, workspaceLabel } from "./test-labels.js";

const bug = workspaceLabel("l_bug", "Bug");
const docs = workspaceLabel("l_docs", "Docs");
const labels = [docs, bug, taskLabel("c1", "Bug", "t1")];

const failure = <A>(
  result: Result.Result<A, { message: string; hint?: string }>,
) =>
  Result.isFailure(result)
    ? { message: result.failure.message, hint: result.failure.hint }
    : null;

describe("pickLabels", () => {
  it("returns workspace labels in the order asked, without duplicates", () => {
    expect(pickLabels(labels, ["docs", "BUG", "Docs"])).toEqual(
      Result.succeed([docs, bug]),
    );
  });

  it("never picks a task copy", () => {
    expect(pickLabels(labels, ["c1"])).toEqual(Result.fail(expect.anything()));
  });

  it("lists every unknown name and the existing labels", () => {
    expect(
      failure(pickLabels(labels, ["Bug", "Urgent", "Needs review"])),
    ).toEqual({
      message: 'No labels named "Urgent", "Needs review" in this workspace.',
      hint: "Existing labels: Bug, Docs. Create one with kaneo label create Urgent.",
    });
    expect(failure(pickLabels([], ["Needs review"]))).toEqual({
      message: 'No label named "Needs review" in this workspace.',
      hint: 'This workspace has no labels yet. Create one with kaneo label create "Needs review".',
    });
  });

  it("refuses labels that are being deleted", () => {
    const deleting = workspaceLabel("l_old", "Old", {
      deletionStartedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(failure(pickLabels([deleting], ["old"]))).toEqual({
      message: "The label Old is being deleted.",
      hint: "Run kaneo label delete Old to finish deleting it.",
    });
  });

  it("asks for an id when a name is ambiguous", () => {
    const lower = workspaceLabel("l_bug2", "bug");
    expect(failure(pickLabels([bug, lower], ["BUG"]))?.hint).toBe(
      "Pass the label id instead: Bug (l_bug), bug (l_bug2).",
    );
  });
});
