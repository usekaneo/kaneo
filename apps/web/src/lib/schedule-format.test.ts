import { describe, expect, it } from "vitest";
import { describeWorkDays, formatMoney } from "./schedule-format";

describe("describeWorkDays", () => {
  it("shows a run of days as a range, also across the weekend", () => {
    expect(describeWorkDays([1, 2, 3, 4, 5], "en-US")).toBe("Mon–Fri");
    expect(describeWorkDays([7, 1, 2, 3, 4], "en-US")).toBe("Sun–Thu");
    expect(describeWorkDays([6, 7, 1], "en-US")).toBe("Sat–Mon");
  });

  it("lists days that are not consecutive", () => {
    expect(describeWorkDays([1, 3, 5], "en-US")).toBe("Mon, Wed, Fri");
    expect(describeWorkDays([1, 2], "en-US")).toBe("Mon, Tue");
  });
});

describe("formatMoney", () => {
  it("formats minor units in the workspace currency", () => {
    // Intl separates the code with a no-break space.
    expect(formatMoney(4_000_000, "BDT", "en-US")).toBe("৳40,000.00");
    expect(formatMoney(1999, "USD", "en-US")).toBe("$19.99");
  });
});
