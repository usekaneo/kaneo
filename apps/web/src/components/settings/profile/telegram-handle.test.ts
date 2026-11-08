import { describe, expect, it } from "vite-plus/test";
import { normalizeTelegramHandleInput } from "./telegram-handle";

describe("normalizeTelegramHandleInput", () => {
  it.each([
    ["@Alex_Name", "alex_name"],
    ["t.me/alex_name", "alex_name"],
    ["123456789", "123456789"],
    ["", null],
    ["   ", null],
  ])("normalizes %p to %p", (input, expected) => {
    expect(normalizeTelegramHandleInput(input)).toBe(expected);
  });

  it.each(["ab", "1alex", "alex-name", "alex name", "0"])(
    "rejects %p",
    (input) => {
      expect(() => normalizeTelegramHandleInput(input)).toThrow();
    },
  );
});
