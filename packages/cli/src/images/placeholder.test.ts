import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { renderCaption, renderPlaceholder } from "./placeholder.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const image = { url: "https://kaneo.test/api/asset/a1", alt: "Diagram" };

describe("renderPlaceholder", () => {
  it("names the image and why it is not shown", () => {
    expect(renderPlaceholder(ui, image, 60, "not found")).toBe(
      "[image: Diagram] · not found",
    );
    expect(renderPlaceholder(ui, { ...image, alt: "" }, 60)).toBe("[image]");
  });

  it("links the label to the image", () => {
    const linked = makeUi({ ...ui.caps, hyperlinks: true });
    expect(renderPlaceholder(linked, image, 60)).toBe(
      "\u001b]8;;https://kaneo.test/api/asset/a1\u001b\\[image: Diagram]\u001b]8;;\u001b\\",
    );
  });
});

describe("renderCaption", () => {
  it("falls back to a generic caption and truncates long ones", () => {
    expect(renderCaption(ui, { ...image, alt: "" }, 60)).toBe("Image");
    expect(renderCaption(ui, { ...image, alt: "x".repeat(30) }, 10)).toBe(
      "xxxxxxxxx…",
    );
  });
});
