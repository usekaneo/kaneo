import { describe, expect, it } from "vite-plus/test";
import {
  FALLBACK_LABEL_COLOR,
  TRELLO_LABEL_COLORS,
  trelloColorName,
  trelloLabelColor,
} from "./colors.js";

describe("TRELLO_LABEL_COLORS", () => {
  it("covers the 10 base colors with dark and light variants as hex", () => {
    const names = Object.keys(TRELLO_LABEL_COLORS);
    expect(names).toHaveLength(30);
    for (const base of [
      "green",
      "yellow",
      "orange",
      "red",
      "purple",
      "blue",
      "sky",
      "lime",
      "pink",
      "black",
    ]) {
      expect(names).toContain(base);
      expect(names).toContain(`${base}_dark`);
      expect(names).toContain(`${base}_light`);
    }
    for (const hex of Object.values(TRELLO_LABEL_COLORS)) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("trelloLabelColor", () => {
  it("maps named colors to hex", () => {
    expect(trelloLabelColor("green")).toBe("#4bce97");
    expect(trelloLabelColor("sky_dark")).toBe("#227d9b");
    expect(trelloLabelColor("pink_light")).toBe("#fdd0ec");
  });

  it("falls back for missing or unknown colors", () => {
    expect(trelloLabelColor(null)).toBe(FALLBACK_LABEL_COLOR);
    expect(trelloLabelColor(undefined)).toBe(FALLBACK_LABEL_COLOR);
    expect(trelloLabelColor("ping_light")).toBe(FALLBACK_LABEL_COLOR);
    expect(trelloLabelColor("constructor")).toBe(FALLBACK_LABEL_COLOR);
  });
});

describe("trelloColorName", () => {
  it("capitalizes the color and spells out variants", () => {
    expect(trelloColorName("green")).toBe("Green");
    expect(trelloColorName("sky_light")).toBe("Sky light");
    expect(trelloColorName(null)).toBeUndefined();
    expect(trelloColorName("")).toBeUndefined();
  });
});
