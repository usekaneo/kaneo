import { describe, expect, it } from "vite-plus/test";
import { formatBinding } from "./format-binding";

describe("formatBinding", () => {
  it("uses Mac symbols in the standard modifier order", () => {
    expect(formatBinding("mod+shift+,", true)).toEqual([["⌘", "⇧", ","]]);
    expect(formatBinding("alt+shift+q", true)).toEqual([["⌥", "⇧", "Q"]]);
    expect(formatBinding("ctrl+shift+1–9", true)).toEqual([["⌃", "⇧", "1–9"]]);
  });

  it("spells modifiers out elsewhere", () => {
    expect(formatBinding("mod+backspace", false)).toEqual([["Ctrl", "⌫"]]);
    expect(formatBinding("alt+shift+q", false)).toEqual([
      ["Alt", "Shift", "Q"],
    ]);
  });

  it("splits sequences and names special keys", () => {
    expect(formatBinding("g i", true)).toEqual([["G"], ["I"]]);
    expect(formatBinding("arrowdown", true)).toEqual([["↓"]]);
  });
});
