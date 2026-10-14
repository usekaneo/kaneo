import { describe, expect, it } from "vite-plus/test";
import { capMatcher, matchesShortcut } from "./match-shortcut";

const deleteCaps = [[["⌘", "⌫"]]];
const inboxCaps = [[["G"], ["I"]]];

describe("matchesShortcut", () => {
  it("matches labels by words", () => {
    expect(matchesShortcut("Delete task", deleteCaps, "delete")).toBe(true);
    expect(matchesShortcut("Delete task", deleteCaps, "assign")).toBe(false);
  });

  it("matches keys by glyph, letter or name", () => {
    expect(matchesShortcut("Delete task", deleteCaps, "⌘")).toBe(true);
    expect(matchesShortcut("Delete task", deleteCaps, "cmd")).toBe(true);
    expect(matchesShortcut("Go to inbox", inboxCaps, "i")).toBe(true);
    expect(matchesShortcut("Delete task", deleteCaps, "backspace")).toBe(true);
  });

  it("shows everything for an empty query", () => {
    expect(matchesShortcut("Delete task", deleteCaps, "  ")).toBe(true);
  });
});

describe("capMatcher", () => {
  it("only highlights caps for key-like queries", () => {
    expect(capMatcher("shift")?.("⇧")).toBe(true);
    expect(capMatcher("g")?.("G")).toBe(true);
    expect(capMatcher("delete task")).toBeNull();
  });
});
