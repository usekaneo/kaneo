import { describe, expect, it } from "vite-plus/test";
import { followUpIso, followUpState } from "./follow-up-label";

const now = new Date(2030, 5, 15, 14, 0);

describe("followUpState", () => {
  it("buckets by calendar day, not by hour", () => {
    expect(followUpState(null, now)).toBe("none");
    expect(followUpState(new Date(2030, 5, 14, 23, 0).toISOString(), now)).toBe(
      "overdue",
    );
    expect(followUpState(new Date(2030, 5, 15, 8, 0).toISOString(), now)).toBe(
      "today",
    );
    expect(followUpState(new Date(2030, 5, 16, 0, 0).toISOString(), now)).toBe(
      "upcoming",
    );
  });
});

describe("followUpIso", () => {
  it("schedules a picked date and ignores blank or malformed input", () => {
    expect(new Date(followUpIso("2030-06-20") as string).getHours()).toBe(9);
    expect(followUpIso("")).toBeUndefined();
    expect(followUpIso("20-06-2030")).toBeUndefined();
  });
});
