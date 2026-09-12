import { describe, expect, it } from "vitest";
import {
  validateAndParseDate,
  validateDateRange,
} from "../../../apps/api/src/utils/validate-dates";

describe("validateAndParseDate", () => {
  it("should parse a valid ISO date string", () => {
    const result = validateAndParseDate("2026-08-01T00:00:00.000Z", "dueDate");
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("should parse a date-only string", () => {
    const result = validateAndParseDate("2026-08-01", "startDate");
    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result.getTime())).toBe(false);
  });

  it("should throw on an invalid date string", () => {
    expect(() => validateAndParseDate("not-a-date", "dueDate")).toThrowError(
      /Invalid dueDate/,
    );
  });

  it("should throw on an empty string", () => {
    expect(() => validateAndParseDate("", "startDate")).toThrowError(
      /startDate cannot be an empty string/,
    );
  });

  it("should throw on a whitespace-only string", () => {
    expect(() => validateAndParseDate("   ", "dueDate")).toThrowError(
      /dueDate cannot be an empty string/,
    );
  });

  it("should throw on a gibberish string", () => {
    expect(() => validateAndParseDate("abc123xyz", "dueDate")).toThrowError(
      /Invalid dueDate/,
    );
  });
});

describe("validateDateRange", () => {
  it("should not throw when startDate is before dueDate", () => {
    const start = new Date("2026-07-01");
    const due = new Date("2026-08-01");
    expect(() => validateDateRange(start, due)).not.toThrow();
  });

  it("should not throw when startDate equals dueDate", () => {
    const date = new Date("2026-08-01");
    expect(() => validateDateRange(date, date)).not.toThrow();
  });

  it("should throw when startDate is after dueDate", () => {
    const start = new Date("2026-09-01");
    const due = new Date("2026-08-01");
    expect(() => validateDateRange(start, due)).toThrowError(
      /Start date cannot be after due date/,
    );
  });

  it("should not throw when only startDate is provided", () => {
    const start = new Date("2026-08-01");
    expect(() => validateDateRange(start, undefined)).not.toThrow();
  });

  it("should not throw when only dueDate is provided", () => {
    const due = new Date("2026-08-01");
    expect(() => validateDateRange(undefined, due)).not.toThrow();
  });

  it("should not throw when both are null/undefined", () => {
    expect(() => validateDateRange(null, null)).not.toThrow();
    expect(() => validateDateRange(undefined, undefined)).not.toThrow();
  });
});
