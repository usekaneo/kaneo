import { describe, expect, it } from "vite-plus/test";
import { renderCell } from "../render/cell.js";
import { makeUi } from "../render/ui.js";
import { labelChips } from "./label-chips.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const labels = ["bug", "auth", "frontend", "needs-design"].map((name) => ({
  name,
  color: "red",
}));

const chips = (width: number, count = labels.length) =>
  renderCell(labelChips(ui, labels.slice(0, count), width), ui);

describe("labelChips", () => {
  it("shows every label when they fit", () => {
    expect(chips(80)).toBe("● bug  ● auth  ● frontend  ● needs-design");
  });

  it("drops whole chips and counts the rest when space runs out", () => {
    expect(chips(30)).toBe("● bug  ● auth  ● frontend  +1");
    expect(chips(20)).toBe("● bug  ● auth  +2");
  });

  it("cuts a single label that is wider than the row", () => {
    expect(chips(5, 1)).toBe("● bug");
    expect(chips(4, 1)).toBe("● b…");
  });

  it("colors each chip with its label color", () => {
    const truecolor = makeUi({ ...ui.caps, color: 3 });
    expect(
      renderCell(labelChips(truecolor, labels.slice(0, 1), 80), truecolor),
    ).toBe("\u001b[38;2;231;0;11m●\u001b[39m bug");
  });
});
