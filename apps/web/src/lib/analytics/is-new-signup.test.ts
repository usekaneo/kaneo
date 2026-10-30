import { describe, expect, it } from "vite-plus/test";
import { isNewSignup } from "./is-new-signup";

const now = Date.parse("2026-10-05T09:00:00Z");

describe("isNewSignup", () => {
  it("treats an account created moments ago as a new signup", () => {
    expect(isNewSignup("2026-10-05T08:59:30Z", now)).toBe(true);
  });

  it("accepts Date values from the session", () => {
    expect(isNewSignup(new Date("2026-10-05T08:40:00Z"), now)).toBe(true);
  });

  it("ignores accounts older than thirty minutes", () => {
    expect(isNewSignup("2026-10-05T08:29:59Z", now)).toBe(false);
  });

  it("ignores invalid and future timestamps", () => {
    expect(isNewSignup("not a date", now)).toBe(false);
    expect(isNewSignup("2026-10-05T09:05:00Z", now)).toBe(false);
  });
});
