import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { renderTaskSections } from "./render-task-sections.js";
import { failed, loaded } from "./section-result.js";
import { type TaskViewJson, toTaskViewJson } from "./task-view-json.js";
import type { TaskViewSections } from "./task-view-sections.js";
import {
  commentsFixture,
  projectSlugsFixture,
  resolvedTask,
  sectionsFixture,
  viewNow,
  webUrl,
} from "./test-task-view.js";

const ui = (columns = 80) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const json = (
  sections: Partial<TaskViewSections> = {},
  commentLimit = 3,
): TaskViewJson =>
  toTaskViewJson({
    resolved: resolvedTask,
    sections: { ...sectionsFixture, ...sections },
    projectSlugs: projectSlugsFixture,
    webUrl,
    commentLimit,
    now: viewNow,
  });

const render = (task: TaskViewJson, commentTotal = 5, columns = 80) =>
  renderTaskSections(ui(columns), { task, commentTotal, now: viewNow });

const titles = (lines: ReadonlyArray<string>) =>
  lines.filter((line) => /^ {2}\S/u.test(line));

describe("renderTaskSections", () => {
  it("renders the sections in order, each followed by a blank line", () => {
    const lines = render(json());
    expect(titles(lines)).toEqual([
      "  Subtasks 2 of 5 done",
      "  Relations",
      "  Links",
      "  Custom fields",
      "  Recent comments",
    ]);
    for (const title of titles(lines).slice(1)) {
      expect(lines[lines.indexOf(title) - 1]).toBe("");
    }
    expect(lines.at(-1)).toBe("");
  });

  it("groups subtasks and relations with status dots and done markers", () => {
    const lines = render(json());
    expect(lines.slice(0, 11)).toEqual([
      "  Subtasks 2 of 5 done",
      "    ● KAN-13  Reproduce on Safari                           ✓",
      "    ● KAN-14  Add a regression test                         ✓",
      "    ● KAN-15  Handle expired device codes",
      "    ● KAN-16  Update the login docs",
      "    ● KAN-17  Clean up the redirect helper and its callers",
      "",
      "  Relations",
      "    Blocks      ● KAN-20  Release 2.36",
      "    Blocked by  ● KAN-9   Session cookie on the API domain",
      "    Related     ● MOB-3   Mobile sign in",
    ]);
  });

  it("lists links and the custom fields that have a value", () => {
    const lines = render(json(), 5, 100);
    const links = lines.indexOf("  Links");
    expect(lines.slice(links, links + 7)).toEqual([
      "  Links",
      "    fix(auth): keep state on device redirect  github.com/usekaneo/kaneo/pull/1960  github",
      "    sentry.io/issues/4211",
      "",
      "  Custom fields",
      "    Story points  5",
      "    Platforms     Web, CLI",
    ]);
  });

  it("previews the latest comments and points to the rest", () => {
    const lines = render(json());
    const comments = lines.indexOf("  Recent comments");
    expect(lines.slice(comments)).toEqual([
      "  Recent comments",
      "    Grace Hopper · Yesterday",
      "      It started with the cookie change.",
      "      The callback URL drops the state param when the device page redirects, so",
      "      the CLI never sees the approval and keeps polling until the code expires.",
      "",
      "    Ada Lovelace · 3h ago · edited",
      "      First pass is up, please review.",
      "",
      "    Grace Hopper · 1h ago",
      "      Looks good. One question:",
      "      • do we still need the fallback?",
      "      • can we drop the retry? …",
      "",
      "    and 2 more, run kaneo comment list KAN-12",
      "",
    ]);
  });

  it("titles the section Comments when every comment is shown", () => {
    const lines = render(json({}, Number.POSITIVE_INFINITY));
    expect(lines).toContain("  Comments");
    expect(lines.some((line) => line.includes("more, run"))).toBe(false);
  });

  it("shows whole comment bodies in full mode", () => {
    const lines = renderTaskSections(ui(), {
      task: json({}, Number.POSITIVE_INFINITY),
      commentTotal: 5,
      now: viewNow,
      full: true,
    });
    const last = lines.lastIndexOf("    Grace Hopper · 1h ago");
    expect(lines.slice(last)).toEqual([
      "    Grace Hopper · 1h ago",
      "      Looks good. One question:",
      "",
      "      • do we still need the fallback?",
      "      • can we drop the retry?",
      "      • what about older servers?",
      "      • and API keys?",
      "",
    ]);
  });

  it("leaves out sections without content", () => {
    expect(
      render(
        json({
          relations: loaded([]),
          links: loaded([]),
          fields: loaded([
            {
              fieldId: "f1",
              value: "[]",
              fieldName: "Platforms",
              fieldType: "multiselect",
              fieldPosition: 0,
            },
          ]),
          comments: loaded([]),
        }),
        0,
      ),
    ).toEqual([]);
  });

  it("shows one muted line for each section that could not load", () => {
    expect(
      render(
        json({
          relations: failed("boom"),
          links: failed("boom"),
          fields: failed("boom"),
          comments: failed("boom"),
        }),
        0,
      ),
    ).toEqual([
      "  Relations could not load",
      "",
      "  Links could not load",
      "",
      "  Custom fields could not load",
      "",
      "  Comments could not load",
      "",
    ]);
  });

  it("marks empty comments and cuts long ones with an ellipsis", () => {
    const comment = commentsFixture[0];
    if (!comment) throw new Error("missing fixture");
    const lines = render(
      json({
        comments: loaded([
          { ...comment, id: "e", content: "  " },
          { ...comment, id: "l", content: "x".repeat(200) },
        ]),
      }),
      2,
      40,
    );
    expect(lines).toContain("      (empty)");
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(40);
  });

  it("fits every line at narrow widths", () => {
    for (const columns of [40, 60, 80, 120]) {
      for (const line of render(json(), 5, columns)) {
        expect(stringWidth(line)).toBeLessThanOrEqual(columns);
      }
    }
  });
});
