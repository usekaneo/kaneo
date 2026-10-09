import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { renderSearch, statusLabel } from "./render-search.js";
import type { SearchResultJson } from "./search-results.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

function result(overrides: Partial<SearchResultJson>): SearchResultJson {
  return {
    type: "task",
    id: "t1",
    title: "Fix login redirect after device approval",
    ticketId: "KAN-1",
    status: "in-progress",
    priority: "high",
    snippet: null,
    projectId: "p_kan",
    projectKey: "KAN",
    projectName: "Kaneo Web",
    workspaceId: "ws_acme",
    assignee: null,
    author: null,
    createdAt: "2026-10-07T19:19:55.746Z",
    url: "https://kaneo.test/task/t1",
    ...overrides,
  };
}

const results: SearchResultJson[] = [
  result({}),
  result({
    type: "project",
    id: "p_kan",
    title: "Kaneo Web",
    ticketId: null,
    status: null,
  }),
  result({
    type: "comment",
    id: "a1",
    title: "Comment on Fix login redirect after device approval",
    status: null,
    snippet: "Still broken on Safari",
    author: "Grace Hopper",
  }),
  result({
    id: "t2",
    ticketId: "KAN-6",
    title: "Review API error shape",
    status: "in-review",
  }),
];

describe("statusLabel", () => {
  it("turns a column slug into words", () => {
    expect(statusLabel("in-progress")).toBe("In Progress");
    expect(statusLabel("to_do")).toBe("To Do");
  });
});

describe("renderSearch", () => {
  it("groups results by kind at 80 columns", () => {
    const lines = renderSearch(ui(80), {
      query: "login",
      results,
      more: false,
      limit: 20,
    });
    expect(lines).toEqual([
      "",
      "  Tasks 2",
      "    KAN-1  Fix login redirect after device approval  ● In Progress",
      "    KAN-6  Review API error shape                    ● In Review",
      "",
      "  Projects 1",
      "    KAN  Kaneo Web",
      "",
      "  Comments 1",
      "    KAN-1  Still broken on Safari  Grace Hopper",
      "",
    ]);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });

  it("never wraps on a narrow terminal", () => {
    for (const line of renderSearch(ui(32), {
      query: "login",
      results,
      more: false,
      limit: 20,
    })) {
      expect(stringWidth(line)).toBeLessThanOrEqual(32);
    }
  });

  it("points at --limit when there are more matches", () => {
    const lines = renderSearch(ui(80), {
      query: "login",
      results,
      more: true,
      limit: 20,
    });
    expect(lines).toContain(
      "  There are more matches. Pass --limit (up to 50) to see more.",
    );
  });

  it("says when nothing matched", () => {
    expect(
      renderSearch(ui(80), {
        query: "zebra",
        results: [],
        more: false,
        limit: 20,
      }),
    ).toEqual(["", '  No results for "zebra".', ""]);
  });
});
