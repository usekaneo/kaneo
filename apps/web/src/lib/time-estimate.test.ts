import { describe, expect, it } from "vitest";
import { formatTimeEstimate, parseTimeEstimate } from "./time-estimate";

describe("parseTimeEstimate", () => {
  it("parses combined units", () => {
    expect(parseTimeEstimate("2h 30m")).toBe(9000);
    expect(parseTimeEstimate("2h30m")).toBe(9000);
    expect(parseTimeEstimate("1d 1h")).toBe(90000);
  });

  it("parses decimals and single units", () => {
    expect(parseTimeEstimate("1.5h")).toBe(5400);
    expect(parseTimeEstimate("90m")).toBe(5400);
    expect(parseTimeEstimate("45s")).toBe(45);
    expect(parseTimeEstimate("1w")).toBe(604800);
  });

  it("ignores case and extra whitespace", () => {
    expect(parseTimeEstimate("2H 30M")).toBe(9000);
    expect(parseTimeEstimate("  1h   ")).toBe(3600);
  });

  it("rejects values overflowing a 32-bit integer", () => {
    expect(parseTimeEstimate("999999999999h")).toBeNull();
  });

  it("treats bare numbers as minutes", () => {
    expect(parseTimeEstimate("90")).toBe(5400);
  });

  it("parses zero as 0 (callers treat it as clear)", () => {
    expect(parseTimeEstimate("0")).toBe(0);
    expect(parseTimeEstimate("0h")).toBe(0);
  });

  it("rejects empty and invalid input", () => {
    expect(parseTimeEstimate("")).toBeNull();
    expect(parseTimeEstimate("  ")).toBeNull();
    expect(parseTimeEstimate("abc")).toBeNull();
    expect(parseTimeEstimate("2x")).toBeNull();
    expect(parseTimeEstimate("-5h")).toBeNull();
  });
});

describe("formatTimeEstimate", () => {
  it("formats in hours, minutes and seconds only", () => {
    expect(formatTimeEstimate(9000)).toBe("2h 30m");
    expect(formatTimeEstimate(90)).toBe("1m 30s");
    expect(formatTimeEstimate(45)).toBe("45s");
    expect(formatTimeEstimate(90000)).toBe("25h");
    expect(formatTimeEstimate(604800)).toBe("168h");
    expect(formatTimeEstimate(null)).toBe("");
    expect(formatTimeEstimate(0)).toBe("0m");
  });
});
