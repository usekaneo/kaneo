import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { renderCommentChange } from "./render-comment-change.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });
const url = "https://kaneo.test/task/1";

describe("renderCommentChange", () => {
  it("shows the verb, the task and a plain preview", () => {
    expect(
      renderCommentChange(ui(80), {
        verb: "Edited",
        label: "KAN-3",
        url,
        content: "**Ship** it\n\nThen celebrate",
      }),
    ).toEqual(["", "  ✓ Edited a comment on KAN-3 · Ship it …", ""]);
  });

  it("leaves out the preview for empty content", () => {
    expect(
      renderCommentChange(ui(80), {
        verb: "Deleted",
        label: "KAN-3",
        url,
        content: "",
      })[1],
    ).toBe("  ✓ Deleted a comment on KAN-3");
  });

  it("fits the preview to the terminal width", () => {
    const [, line = ""] = renderCommentChange(ui(50), {
      verb: "Deleted",
      label: "KAN-3",
      url,
      content: "word ".repeat(40),
    });
    expect(stringWidth(line)).toBeLessThanOrEqual(50);
    expect(line.endsWith("…")).toBe(true);
  });
});
