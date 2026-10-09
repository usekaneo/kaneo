import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderAttached } from "./render-attached.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderAttached", () => {
  const attached = { label: "KAN-1", url: "https://kaneo.test/t" };

  it("names one or two files and counts more", () => {
    expect(
      renderAttached(ui, {
        ...attached,
        names: ["shot.png"],
        target: "description",
      }),
    ).toEqual([
      "  ✓ Attached shot.png to KAN-1 · added to the description",
      "",
    ]);
    expect(
      renderAttached(ui, {
        ...attached,
        names: ["a.png", "b.pdf"],
        target: "comment",
      })[0],
    ).toBe("  ✓ Attached a.png and b.pdf to KAN-1 · posted as a comment");
    expect(
      renderAttached(ui, {
        ...attached,
        names: ["a", "b", "c"],
        target: "comment",
      })[0],
    ).toBe("  ✓ Attached 3 files to KAN-1 · posted as a comment");
  });
});
