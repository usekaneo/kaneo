import { describe, expect, it } from "vite-plus/test";
import {
  detectCapabilities,
  detectColorLevel,
  detectHyperlinks,
  detectUnicode,
} from "./capabilities.js";

const tty = { isTTY: true, columns: 100 };
const pipe = { isTTY: false, columns: undefined };

describe("detectColorLevel", () => {
  it("is off for pipes", () => {
    expect(detectColorLevel({}, pipe, "darwin")).toBe(0);
  });

  it("respects NO_COLOR", () => {
    expect(
      detectColorLevel(
        { NO_COLOR: "1", COLORTERM: "truecolor" },
        tty,
        "darwin",
      ),
    ).toBe(0);
  });

  it("lets FORCE_COLOR win over NO_COLOR and pipes", () => {
    expect(
      detectColorLevel({ NO_COLOR: "1", FORCE_COLOR: "3" }, pipe, "darwin"),
    ).toBe(3);
    expect(detectColorLevel({ FORCE_COLOR: "0" }, tty, "darwin")).toBe(0);
    expect(detectColorLevel({ FORCE_COLOR: "" }, pipe, "darwin")).toBe(1);
  });

  it("is off for TERM=dumb", () => {
    expect(detectColorLevel({ TERM: "dumb" }, tty, "linux")).toBe(0);
  });

  it("detects truecolor and 256 colors", () => {
    expect(detectColorLevel({ COLORTERM: "truecolor" }, tty, "linux")).toBe(3);
    expect(detectColorLevel({ TERM_PROGRAM: "ghostty" }, tty, "darwin")).toBe(
      3,
    );
    expect(detectColorLevel({ TERM: "xterm-256color" }, tty, "linux")).toBe(2);
    expect(detectColorLevel({ TERM: "xterm" }, tty, "linux")).toBe(1);
  });
});

describe("detectUnicode", () => {
  it("falls back to ascii for dumb terminals and non UTF-8 locales", () => {
    expect(detectUnicode({ TERM: "dumb" }, "linux")).toBe(false);
    expect(detectUnicode({ LANG: "C" }, "linux")).toBe(false);
    expect(detectUnicode({ LANG: "en_US.UTF-8" }, "linux")).toBe(true);
    expect(detectUnicode({}, "darwin")).toBe(true);
  });

  it("needs a modern Windows terminal", () => {
    expect(detectUnicode({}, "win32")).toBe(false);
    expect(detectUnicode({ WT_SESSION: "1" }, "win32")).toBe(true);
  });
});

describe("detectHyperlinks", () => {
  it("only enables known terminals", () => {
    expect(detectHyperlinks({ TERM_PROGRAM: "iTerm.app" }, tty)).toBe(true);
    expect(detectHyperlinks({ TERM_PROGRAM: "Apple_Terminal" }, tty)).toBe(
      false,
    );
    expect(detectHyperlinks({ TERM: "xterm-kitty" }, tty)).toBe(true);
    expect(detectHyperlinks({ TERM_PROGRAM: "iTerm.app" }, pipe)).toBe(false);
  });

  it("can be forced either way", () => {
    expect(detectHyperlinks({ FORCE_HYPERLINK: "1" }, pipe)).toBe(true);
    expect(
      detectHyperlinks(
        { FORCE_HYPERLINK: "0", TERM_PROGRAM: "iTerm.app" },
        tty,
      ),
    ).toBe(false);
  });
});

describe("detectCapabilities", () => {
  it("never animates on CI or pipes", () => {
    expect(detectCapabilities({ CI: "true" }, tty, "linux").animate).toBe(
      false,
    );
    expect(detectCapabilities({}, pipe, "linux").animate).toBe(false);
    expect(detectCapabilities({}, tty, "linux").animate).toBe(true);
  });

  it("uses COLUMNS when the stream has no width", () => {
    expect(detectCapabilities({ COLUMNS: "132" }, pipe, "linux").columns).toBe(
      132,
    );
    expect(detectCapabilities({}, pipe, "linux").columns).toBe(80);
  });
});
