import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  defaultLabelColor,
  FALLBACK_LABEL_HEX,
  LABEL_PALETTE,
  labelColorHex,
  labelColorName,
  parseLabelColor,
} from "./label-colors.js";

const parsed = (input: string) => {
  const result = parseLabelColor(input);
  return Result.isSuccess(result) ? result.success : result.failure.message;
};

describe("labelColorHex", () => {
  it("maps the web palette keys and names to hex", () => {
    expect(labelColorHex("gray")).toBe("#79716b");
    expect(labelColorHex("red")).toBe("#e7000b");
    expect(labelColorHex("Crimson")).toBe("#e7000b");
    expect(labelColorHex("dark-gray")).toBe("#62748e");
  });

  it("normalizes hex colors and drops alpha", () => {
    expect(labelColorHex("#FF6600")).toBe("#ff6600");
    expect(labelColorHex("#f60")).toBe("#ff6600");
    expect(labelColorHex("#f60c")).toBe("#ff6600");
    expect(labelColorHex("#ff660080")).toBe("#ff6600");
    expect(labelColorHex("ff6600")).toBe("#ff6600");
  });

  it("falls back for colors it cannot read", () => {
    expect(labelColorHex("blue")).toBe(FALLBACK_LABEL_HEX);
    expect(labelColorHex("#12345")).toBe(FALLBACK_LABEL_HEX);
    expect(labelColorHex("")).toBe(FALLBACK_LABEL_HEX);
  });
});

describe("labelColorName", () => {
  it("names palette colors and leaves hex alone", () => {
    expect(labelColorName("purple")).toBe("lavender");
    expect(labelColorName("#8e51ff")).toBeNull();
  });
});

describe("parseLabelColor", () => {
  it("stores palette names as the keys the web app uses", () => {
    expect(parsed("crimson")).toBe("red");
    expect(parsed(" Lavender ")).toBe("purple");
    expect(parsed("red")).toBe("red");
    expect(parsed("dark-gray")).toBe("dark-gray");
  });

  it("accepts hex with or without the hash", () => {
    expect(parsed("#E7000B")).toBe("#e7000b");
    expect(parsed("e7000b")).toBe("#e7000b");
    expect(parsed("#abc")).toBe("#aabbcc");
  });

  it("rejects anything else with the accepted names in the hint", () => {
    const result = parseLabelColor("blurple");
    expect(Result.isFailure(result) && result.failure.message).toBe(
      '"blurple" is not a label color.',
    );
    expect(Result.isFailure(result) && result.failure.hint).toContain(
      "stone, slate, lavender",
    );
    expect(parsed("#12345")).toBe('"#12345" is not a label color.');
    expect(parsed("#ff660080")).toBe('"#ff660080" is not a label color.');
  });
});

describe("defaultLabelColor", () => {
  it("is stable for the same name", () => {
    expect(defaultLabelColor("Bug", [])).toBe(defaultLabelColor("bug", []));
  });

  it("prefers palette colors no label uses yet", () => {
    const used = LABEL_PALETTE.slice(1).map((color) => color.key);
    expect(defaultLabelColor("Anything", used)).toBe("gray");
    expect(defaultLabelColor("Else", [...used.slice(1), "#79716b"])).toBe(
      LABEL_PALETTE[1]?.key,
    );
  });

  it("still picks a palette color when every one is taken", () => {
    const all = LABEL_PALETTE.map((color) => color.key);
    expect(all).toContain(defaultLabelColor("Bug", all));
  });
});
