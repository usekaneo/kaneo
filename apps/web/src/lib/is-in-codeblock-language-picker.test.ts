import { describe, expect, it } from "vitest";
import { isInCodeBlockLanguagePicker } from "./is-in-codeblock-language-picker";

describe("isInCodeBlockLanguagePicker", () => {
  it("returns false when target is null", () => {
    expect(isInCodeBlockLanguagePicker(null)).toBe(false);
  });

  it("returns false when target is a non-Element EventTarget (Text node)", () => {
    // Regression: event.relatedTarget can be a Text node (when the pointer
    // moves between text runs). Calling .closest() on it throws TypeError,
    // which used to crash handleEditorMouseLeave. If the helper's
    // `instanceof Element` guard is missing, this call throws and the
    // assertion below fails on the thrown error.
    const text = document.createTextNode("x");
    expect(isInCodeBlockLanguagePicker(text)).toBe(false);
  });

  it("returns true when target is the picker element itself", () => {
    const picker = document.createElement("div");
    picker.className = "kaneo-codeblock-language";
    expect(isInCodeBlockLanguagePicker(picker)).toBe(true);
  });

  it("returns true when target is a descendant of the picker", () => {
    const picker = document.createElement("div");
    picker.className = "kaneo-codeblock-language";
    const child = document.createElement("span");
    picker.appendChild(child);
    expect(isInCodeBlockLanguagePicker(child)).toBe(true);
  });

  it("returns false when target is an Element outside the picker", () => {
    const other = document.createElement("div");
    expect(isInCodeBlockLanguagePicker(other)).toBe(false);
  });
});
