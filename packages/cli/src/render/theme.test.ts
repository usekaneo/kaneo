import { describe, expect, it } from "vite-plus/test";
import { makeTheme, themeCodes } from "./theme.js";

describe("makeTheme", () => {
  it("is plain text without color", () => {
    const theme = makeTheme(0);
    expect(theme.danger("late")).toBe("late");
    expect(theme.strong("bold")).toBe("bold");
  });

  it("uses basic ansi colors at level 1", () => {
    expect(makeTheme(1).danger("late")).toBe("\u001b[31mlate\u001b[39m");
    expect(makeTheme(1).muted("x")).toBe("\u001b[90mx\u001b[39m");
  });

  it("uses the web palette at truecolor", () => {
    expect(makeTheme(3).success("ok")).toBe(
      "\u001b[38;2;5;150;105mok\u001b[39m",
    );
  });

  it("maps to the 256 color cube", () => {
    const styled = makeTheme(2).info("x");
    expect(styled.startsWith("\u001b[38;5;")).toBe(true);
    expect(styled.endsWith("mx\u001b[39m")).toBe(true);
  });

  it("closes only what it opens so styles nest", () => {
    const theme = makeTheme(1);
    expect(theme.strong(`a ${theme.danger("b")} c`)).toBe(
      "\u001b[1ma \u001b[31mb\u001b[39m c\u001b[22m",
    );
  });

  it("leaves empty strings untouched", () => {
    expect(makeTheme(3).accent("")).toBe("");
  });
});

describe("themeCodes", () => {
  it("is empty without color", () => {
    expect(themeCodes(0)).toEqual({
      bold: "",
      muted: "",
      success: "",
      danger: "",
    });
  });
});
