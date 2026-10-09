import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderTimerChange } from "./render-timer-change.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderTimerChange", () => {
  it("prints a stopped timer with its duration", () => {
    expect(
      renderTimerChange(ui, {
        verb: "Stopped",
        label: "KAN-12",
        url: "https://kaneo.test/t",
        details: ["1h 25m"],
      }),
    ).toEqual(["", "  ✓ Stopped KAN-12 · 1h 25m", ""]);
  });

  it("skips empty details", () => {
    expect(
      renderTimerChange(ui, {
        verb: "Logged",
        label: "KAN-3",
        url: "https://kaneo.test/t",
        details: ["45m", "Yesterday", ""],
      }),
    ).toEqual(["", "  ✓ Logged KAN-3 · 45m · Yesterday", ""]);
  });
});
