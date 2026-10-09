import { describe, expect, it } from "vite-plus/test";
import {
  findNameClash,
  labelUsage,
  matchLabel,
  quoteName,
  workspaceLabels,
} from "./match-label.js";
import { taskLabel, workspaceLabel } from "./test-labels.js";

const bug = workspaceLabel("l_bug", "Bug", { color: "red" });
const docs = workspaceLabel("l_docs", "Docs");
const feature = workspaceLabel("l_feature", "Feature request");

describe("matchLabel", () => {
  it("matches by id, then by name ignoring case and spaces", () => {
    expect(matchLabel([bug, docs], "l_docs")).toEqual({
      kind: "found",
      label: docs,
    });
    expect(matchLabel([bug, docs], "  bug ")).toEqual({
      kind: "found",
      label: bug,
    });
    expect(matchLabel([feature], "FEATURE REQUEST")).toEqual({
      kind: "found",
      label: feature,
    });
  });

  it("prefers the exact spelling when names differ only by case", () => {
    const lower = workspaceLabel("l_bug2", "bug");
    expect(matchLabel([bug, lower], "bug")).toEqual({
      kind: "found",
      label: lower,
    });
    expect(matchLabel([bug, lower], "BUG")).toEqual({
      kind: "ambiguous",
      candidates: [bug, lower],
    });
  });

  it("reports no match", () => {
    expect(matchLabel([bug], "Docs")).toEqual({ kind: "none" });
  });
});

describe("workspaceLabels and labelUsage", () => {
  const labels = [
    bug,
    docs,
    taskLabel("c1", "Bug", "t1"),
    taskLabel("c2", "Bug", "t2"),
    taskLabel("c3", "Docs", "t1"),
    taskLabel("c4", "legacy", "t3"),
  ];

  it("keeps only workspace level labels", () => {
    expect(workspaceLabels(labels)).toEqual([bug, docs]);
  });

  it("counts the task copies per name", () => {
    const usage = labelUsage(labels);
    expect(usage.get("Bug")).toBe(2);
    expect(usage.get("Docs")).toBe(1);
    expect(usage.get("Feature")).toBeUndefined();
  });
});

describe("findNameClash", () => {
  it("finds another workspace label with the same name in any case", () => {
    expect(findNameClash([bug, docs], "docs", bug)).toEqual({
      kind: "workspace",
      label: docs,
    });
    expect(findNameClash([bug, docs], "BUG")).toEqual({
      kind: "workspace",
      label: bug,
    });
  });

  it("allows a label to keep or recase its own name", () => {
    expect(findNameClash([bug, docs], "Bug", bug)).toBeNull();
    expect(findNameClash([bug, docs], "bug", bug)).toBeNull();
  });

  it("finds tasks that already carry the new name next to the old one", () => {
    const labels = [
      bug,
      taskLabel("c1", "Bug", "t1"),
      taskLabel("c2", "Defect", "t1"),
      taskLabel("c3", "Defect", "t2"),
    ];
    expect(findNameClash(labels, "Defect", bug)).toEqual({ kind: "task" });
    expect(findNameClash(labels, "Issue", bug)).toBeNull();
  });
});

describe("quoteName", () => {
  it("quotes names a shell would split", () => {
    expect(quoteName("Bug")).toBe("Bug");
    expect(quoteName("needs-review")).toBe("needs-review");
    expect(quoteName("Feature request")).toBe('"Feature request"');
  });
});
