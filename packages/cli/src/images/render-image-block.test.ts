import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stripAnsi } from "../render/width.js";
import { renderImageBlock } from "./render-image-block.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const linked = makeUi({
  color: 3,
  unicode: true,
  hyperlinks: true,
  animate: false,
  columns: 80,
});

const image = { url: "https://kaneo.test/api/asset/a1", alt: "Login page" };

describe("renderImageBlock", () => {
  it("indents the picture and puts the caption below it", () => {
    expect(
      renderImageBlock(
        ui,
        image,
        { _tag: "Art", lines: ["##", "##"], columns: 2, rows: 2 },
        2,
      ),
    ).toEqual(["  ##", "  ##", "  Login page"]);
  });

  it("shows a linked placeholder with the reason", () => {
    const [line = ""] = renderImageBlock(
      linked,
      image,
      { _tag: "Unsupported", reason: "GIF cannot be shown here" },
      2,
    );
    expect(stripAnsi(line)).toBe(
      "  [image: Login page] · GIF cannot be shown here",
    );
    expect(line).toContain("\u001b]8;;https://kaneo.test/api/asset/a1\u001b\\");
  });
});
