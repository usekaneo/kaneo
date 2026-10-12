import { describe, expect, it } from "vite-plus/test";
import {
  getLeadTimeMax,
  getValidLeadTimeMinutes,
  leadTimeFromMinutes,
  leadTimeToMinutes,
} from "./lead-time";

describe("lead time", () => {
  it("reads whole days as days and everything else as rounded hours", () => {
    expect(leadTimeFromMinutes(2880)).toEqual({ amount: 2, unit: "days" });
    expect(leadTimeFromMinutes(180)).toEqual({ amount: 3, unit: "hours" });
    expect(leadTimeFromMinutes(5)).toEqual({ amount: 1, unit: "hours" });
  });

  it("converts back to minutes", () => {
    expect(leadTimeToMinutes(2, "days")).toBe(2880);
    expect(leadTimeToMinutes(3, "hours")).toBe(180);
  });

  it("returns minutes only for whole amounts inside the unit limits", () => {
    expect(getLeadTimeMax("days")).toBe(30);
    expect(getLeadTimeMax("hours")).toBe(720);
    expect(getValidLeadTimeMinutes({ amount: 30, unit: "days" })).toBe(43_200);
    expect(getValidLeadTimeMinutes({ amount: 720, unit: "hours" })).toBe(
      43_200,
    );
    expect(getValidLeadTimeMinutes({ amount: 31, unit: "days" })).toBeNull();
    expect(getValidLeadTimeMinutes({ amount: 0, unit: "hours" })).toBeNull();
    expect(getValidLeadTimeMinutes({ amount: 1.5, unit: "hours" })).toBeNull();
    expect(getValidLeadTimeMinutes({ amount: null, unit: "hours" })).toBeNull();
  });
});
