import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import type { CommentJson } from "./comment-json.js";
import { renderCommentList } from "./render-comment-list.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const now = new Date(2026, 9, 8, 15, 0);

const comment = (overrides: Partial<CommentJson>): CommentJson => ({
  id: "c1",
  taskId: "t1",
  author: { id: "u1", name: "Ada Lovelace" },
  content: "Looks good",
  createdAt: new Date(2026, 9, 8, 12, 0).toISOString(),
  updatedAt: new Date(2026, 9, 8, 12, 0).toISOString(),
  edited: false,
  ...overrides,
});

const view = {
  label: "KAN-3",
  title: "Fix login redirect",
  url: "https://kaneo.test/task/1",
  now,
};

describe("renderCommentList", () => {
  it("lists comments oldest first with author, time and id", () => {
    expect(
      renderCommentList(ui(80), {
        ...view,
        total: 2,
        comments: [
          comment({
            id: "c1",
            createdAt: new Date(2026, 9, 7, 9, 0).toISOString(),
            content: "First pass is up.\n\n- check the **redirect**",
          }),
          comment({
            id: "c2",
            author: { id: "u2", name: "Grace Hopper" },
            edited: true,
          }),
        ],
      }),
    ).toEqual([
      "",
      "  KAN-3 Fix login redirect · 2 comments",
      "",
      "  Ada Lovelace · Yesterday  c1",
      "    First pass is up.",
      "",
      "    • check the redirect",
      "",
      "  Grace Hopper · 3h ago · edited  c2",
      "    Looks good",
      "",
    ]);
  });

  it("wraps long comments to the terminal width", () => {
    const lines = renderCommentList(ui(80), {
      ...view,
      total: 1,
      comments: [comment({ content: "word ".repeat(60) })],
    });
    expect(lines.length).toBeGreaterThan(6);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });

  it("says when older comments are hidden", () => {
    expect(
      renderCommentList(ui(80), {
        ...view,
        total: 5,
        comments: [comment({})],
      })[3],
    ).toBe("  Showing the latest 1 of 5. Pass --limit to see more.");
  });

  it("points to comment add when there are none", () => {
    expect(
      renderCommentList(ui(80), { ...view, total: 0, comments: [] }),
    ).toEqual([
      "",
      "  KAN-3 Fix login redirect · 0 comments",
      "",
      "  No comments yet. Add one with kaneo comment add KAN-3",
      "",
    ]);
  });

  it("shows Someone for a missing author", () => {
    expect(
      renderCommentList(ui(80), {
        ...view,
        total: 1,
        comments: [comment({ author: null })],
      })[3],
    ).toBe("  Someone · 3h ago  c1");
  });
});
