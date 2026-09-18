import { paidMinutes, type Schedule } from "../company/schedule";

/** Paid minutes someone's schedule has in a month (days off excluded). */
export function paidMinutesInMonth(
  schedule: Schedule,
  year: number,
  month: number,
) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let total = 0;
  for (let day = 1; day <= last; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    total += paidMinutes(schedule, date);
  }
  return total;
}

export type PayInput = {
  salaryType: "monthly" | "hourly";
  // Minor units per month (monthly) or per hour (hourly).
  salaryAmount: number;
  workedMinutes: number;
  overtimeMinutes: number;
  scheduledPaidMinutes: number;
  overtimeRatePercent: number;
  bonus: number;
  deduction: number;
};

/**
 * One month's pay, in minor units, rounded to whole units.
 * - Monthly: the salary, plus overtime at (salary ÷ paid hours in the month)
 *   × the overtime rate.
 * - Hourly: regular hours at the rate, plus overtime hours at the rate × the
 *   overtime rate.
 */
export function calculatePay(input: PayInput) {
  const overtimeHours = input.overtimeMinutes / 60;
  const ratePercent = input.overtimeRatePercent / 100;

  let baseAmount: number;
  let hourlyRate: number;
  if (input.salaryType === "hourly") {
    hourlyRate = input.salaryAmount;
    const regularHours =
      Math.max(0, input.workedMinutes - input.overtimeMinutes) / 60;
    baseAmount = Math.round(regularHours * hourlyRate);
  } else {
    baseAmount = input.salaryAmount;
    hourlyRate =
      input.scheduledPaidMinutes > 0
        ? input.salaryAmount / (input.scheduledPaidMinutes / 60)
        : 0;
  }

  const overtimeAmount = Math.round(overtimeHours * hourlyRate * ratePercent);
  const netAmount = baseAmount + overtimeAmount + input.bonus - input.deduction;

  return { baseAmount, overtimeAmount, netAmount };
}
