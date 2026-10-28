import { describe, expect, it } from "vite-plus/test";
import { besidePicture } from "./side-by-side.js";

describe("besidePicture", () => {
  it("centers the text next to a taller picture", () => {
    expect(
      besidePicture(
        { lines: ["AAAA", "BBBB", "CCCC", "DDDD"], columns: 4 },
        ["one", "two"],
        { indent: 2, gap: 1 },
      ),
    ).toEqual(["  AAAA", "  BBBB one", "  CCCC two", "  DDDD"]);
  });

  it("pads the picture column when the text is taller", () => {
    expect(
      besidePicture({ lines: ["AA"], columns: 2 }, ["one", "", "three"], {
        indent: 0,
        gap: 2,
      }),
    ).toEqual(["AA  one", "  ", "    three"]);
  });
});
