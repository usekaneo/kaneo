import { describe, expect, it } from "vite-plus/test";
import { LOGO_LINES, LOGO_WIDTH, logo } from "./logo.js";
import { makeUi } from "./ui.js";

const make = (unicode: boolean, columns: number) =>
  makeUi({ color: 0, unicode, hyperlinks: false, animate: false, columns });

describe("logo", () => {
  it("is at most six lines tall", () => {
    expect(LOGO_LINES.length).toBeLessThanOrEqual(6);
  });

  it("uses the full art when it fits", () => {
    expect(logo(make(true, 80))).toHaveLength(LOGO_LINES.length);
  });

  it("collapses to one line on narrow terminals", () => {
    expect(LOGO_WIDTH).toBeGreaterThan(40);
    expect(logo(make(true, 40))).toEqual(["  ▅▆▇ kaneo"]);
  });

  it("uses plain text without unicode", () => {
    expect(logo(make(false, 120))).toEqual(["  kaneo"]);
  });
});
