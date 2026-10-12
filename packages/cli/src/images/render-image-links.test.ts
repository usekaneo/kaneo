import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderImageLinks } from "./render-image-links.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 40,
});

describe("renderImageLinks", () => {
  it("numbers each image and prints its full link below", () => {
    expect(
      renderImageLinks(
        ui,
        [
          {
            url: "https://kaneo.test/api/asset/a-very-long-asset-identifier",
            alt: "A screenshot with a caption that is too long",
          },
        ],
        { indent: 2, hidden: 0 },
      ),
    ).toEqual([
      "  1. A screenshot with a caption that i…",
      "     https://kaneo.test/api/asset/a-very-long-asset-identifier",
      "",
    ]);
  });

  it("aligns numbers and mentions hidden images", () => {
    const images = Array.from({ length: 10 }, (_, index) => ({
      url: `https://kaneo.test/${index}`,
      alt: "",
    }));
    const lines = renderImageLinks(ui, images, { indent: 0, hidden: 1 });
    expect(lines[0]).toBe(" 1. Image");
    expect(lines[18]).toBe("10. Image");
    expect(lines[19]).toBe("    https://kaneo.test/9");
    expect(lines[20]).toBe("1 more image not shown");
  });
});
