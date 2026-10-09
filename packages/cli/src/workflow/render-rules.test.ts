import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { renderRuleChange, renderRuleList } from "./render-rules.js";
import type { RuleJson } from "./rule-json.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const merged: RuleJson = {
  id: "r1",
  integration: "github",
  event: "pr_merged",
  column: { id: "col_done", name: "Done", slug: "done" },
};

const opened: RuleJson = {
  id: "r2",
  integration: "gitlab",
  event: "pr_opened",
  column: { id: "col_review", name: "In review", slug: "in-review" },
};

describe("renderRuleList", () => {
  it("shows integration, event, column and key in 80 columns", () => {
    const lines = renderRuleList(ui, {
      projectName: "Kaneo Web",
      rules: [merged, opened],
    });
    expect(lines).toEqual([
      "",
      "  GitHub  Pull request merged  →  ● Done       github pr_merged",
      "  GitLab  Pull request opened  →  ● In review  gitlab pr_opened",
      "",
    ]);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });

  it("flags a rule whose column is gone", () => {
    const lines = renderRuleList(ui, {
      projectName: "Kaneo Web",
      rules: [{ ...merged, column: { id: "col_x", name: null, slug: null } }],
    });
    expect(lines[1]).toContain("missing column");
  });

  it("explains the defaults when there are no rules", () => {
    expect(renderRuleList(ui, { projectName: "Kaneo Web", rules: [] })).toEqual(
      [
        "",
        "  No workflow rules in Kaneo Web. Integrations use their default columns.",
        "  Add one with kaneo workflow set github pr_merged done.",
        "",
      ],
    );
  });
});

describe("renderRuleChange", () => {
  it("describes a new or changed rule", () => {
    expect(renderRuleChange(ui, { verb: "Set", rule: merged })).toEqual([
      "",
      "  ✓ GitHub pull request merged → moves tasks to Done",
      "",
    ]);
  });

  it("describes a deleted rule", () => {
    expect(renderRuleChange(ui, { verb: "Deleted", rule: opened })).toEqual([
      "",
      "  ✓ Deleted the rule GitLab pull request opened · was In review",
      "",
    ]);
  });
});
