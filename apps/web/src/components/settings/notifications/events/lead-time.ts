export type LeadTimeUnit = "hours" | "days";

export type LeadTime = {
  amount: number | null;
  unit: LeadTimeUnit;
};

const MINUTES_PER_UNIT: Record<LeadTimeUnit, number> = {
  hours: 60,
  days: 1440,
};

const MAX_AMOUNT: Record<LeadTimeUnit, number> = {
  hours: 720,
  days: 30,
};

export function leadTimeFromMinutes(minutes: number): LeadTime {
  if (minutes > 0 && minutes % MINUTES_PER_UNIT.days === 0) {
    return { amount: minutes / MINUTES_PER_UNIT.days, unit: "days" };
  }

  return {
    amount: Math.max(1, Math.round(minutes / MINUTES_PER_UNIT.hours)),
    unit: "hours",
  };
}

export function leadTimeToMinutes(amount: number, unit: LeadTimeUnit) {
  return amount * MINUTES_PER_UNIT[unit];
}

export function getLeadTimeMax(unit: LeadTimeUnit) {
  return MAX_AMOUNT[unit];
}

export function getValidLeadTimeMinutes({ amount, unit }: LeadTime) {
  if (amount === null || !Number.isInteger(amount)) return null;
  if (amount < 1 || amount > MAX_AMOUNT[unit]) return null;
  return leadTimeToMinutes(amount, unit);
}
