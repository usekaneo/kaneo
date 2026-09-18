import { describe, expect, it } from "vitest";
import { effectiveSchedule } from "../../../apps/api/src/company/schedule";
import {
  calculatePay,
  paidMinutesInMonth,
} from "../../../apps/api/src/pay/calculate";

// Sun–Thu, 10:00–19:00 with a 60 minute break: 8 paid hours a day.
const schedule = effectiveSchedule({
  workDays: "7,1,2,3,4",
  workStart: "10:00",
  workEnd: "19:00",
  breakMinutes: 60,
});

describe("paidMinutesInMonth", () => {
  it("counts only scheduled days", () => {
    // September 2026 has 22 Sundays–Thursdays.
    expect(paidMinutesInMonth(schedule, 2026, 9)).toBe(22 * 8 * 60);
  });
});

describe("calculatePay", () => {
  it("pays a monthly salary plus overtime at the overtime rate", () => {
    const pay = calculatePay({
      salaryType: "monthly",
      salaryAmount: 5_000_000, // ৳50,000.00
      workedMinutes: 0,
      overtimeMinutes: 10 * 60,
      scheduledPaidMinutes: 22 * 8 * 60,
      overtimeRatePercent: 150,
      bonus: 200_000,
      deduction: 50_000,
    });
    // Hourly rate = 5,000,000 / 176 h = 28,409.09; 10 h × 1.5 = 426,136.
    expect(pay).toEqual({
      baseAmount: 5_000_000,
      overtimeAmount: 426_136,
      // 28,409.09 × 1.5 per overtime hour.
      overtimeRate: 42_614,
      netAmount: 5_000_000 + 426_136 + 200_000 - 50_000,
    });
  });

  it("pays hourly people for regular and overtime hours separately", () => {
    const pay = calculatePay({
      salaryType: "hourly",
      salaryAmount: 50_000, // ৳500.00 an hour
      workedMinutes: 170 * 60,
      overtimeMinutes: 10 * 60,
      scheduledPaidMinutes: 0,
      overtimeRatePercent: 150,
      bonus: 0,
      deduction: 0,
    });
    expect(pay).toEqual({
      baseAmount: 160 * 50_000,
      overtimeAmount: 10 * 50_000 * 1.5,
      overtimeRate: 75_000,
      netAmount: 160 * 50_000 + 750_000,
    });
  });

  it("pays no overtime when nobody is scheduled to work", () => {
    const pay = calculatePay({
      salaryType: "monthly",
      salaryAmount: 1_000_000,
      workedMinutes: 0,
      overtimeMinutes: 120,
      scheduledPaidMinutes: 0,
      overtimeRatePercent: 150,
      bonus: 0,
      deduction: 0,
    });
    expect(pay.overtimeAmount).toBe(0);
  });
});
