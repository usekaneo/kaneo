import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { renderCommentAdded } from "./render-comment-added.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });
const url = "https://kaneo.test/task/1";

describe("renderCommentAdded", () => {
  it("shows the first line of the comment", () => {
    expect(
      renderCommentAdded(ui(80), {
        label: "KAN-12",
        url,
        content: "Looks good",
      }),
    ).toEqual(["", "  ✓ Commented on KAN-12 · Looks good", ""]);
  });

  it("marks comments with more lines", () => {
    expect(
      renderCommentAdded(ui(80), {
        label: "KAN-12",
        url,
        content: "Looks good\n\nShip it",
      })[1],
    ).toBe("  ✓ Commented on KAN-12 · Looks good …");
  });

  it("fits a long first line to the terminal width", () => {
    const [, line = ""] = renderCommentAdded(ui(40), {
      label: "KAN-12",
      url,
      content: "word ".repeat(30),
    });
    expect(stringWidth(line)).toBeLessThanOrEqual(40);
    expect(line.endsWith("…")).toBe(true);
  });

  it("leaves out the preview when the content is blank", () => {
    expect(
      renderCommentAdded(ui(80), { label: "KAN-12", url, content: "" })[1],
    ).toBe("  ✓ Commented on KAN-12");
  });
});
