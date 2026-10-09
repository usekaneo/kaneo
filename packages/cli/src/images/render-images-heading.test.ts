import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderImagesHeading } from "./render-images-heading.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

describe("renderImagesHeading", () => {
  const heading = {
    label: "KAN-1",
    title: "Fix login redirect",
    url: "https://kaneo.test/t",
  };

  it("counts the images", () => {
    expect(renderImagesHeading(ui, { ...heading, count: 2 })).toEqual([
      "",
      "  KAN-1 Fix login redirect · 2 images",
      "",
    ]);
  });

  it("says when there are none", () => {
    expect(renderImagesHeading(ui, { ...heading, count: 0 })).toEqual([
      "",
      "  KAN-1 Fix login redirect",
      "",
      "  No images in this task.",
      "",
    ]);
  });
});
