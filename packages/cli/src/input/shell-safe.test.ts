import { describe, expect, it } from "vite-plus/test";
import { isShellSafe, shellSafeOr } from "./shell-safe.js";

describe("isShellSafe", () => {
  it("accepts tokens that need no quoting in any shell", () => {
    expect(isShellSafe("Bug")).toBe(true);
    expect(isShellSafe("KAN-12")).toBe(true);
    expect(isShellSafe("quoxax9njxycy4ws7pxuvmk5")).toBe(true);
  });

  it("rejects anything a POSIX shell, cmd or PowerShell would interpret", () => {
    for (const value of [
      'Needs "QA"',
      "it's",
      "$(rm)",
      "a b",
      "a&b",
      "a|b",
      "a^b",
      "%PATH%",
      "a,b",
      "@a",
      "-rf",
      "",
      "Ä-1",
    ]) {
      expect(isShellSafe(value)).toBe(false);
    }
  });
});

describe("shellSafeOr", () => {
  it("falls back to an always safe token", () => {
    expect(shellSafeOr("KAN-12", "id1")).toBe("KAN-12");
    expect(shellSafeOr('Needs "QA"', "lbl_1")).toBe("lbl_1");
    expect(shellSafeOr(null, "task_1")).toBe("task_1");
  });
});
