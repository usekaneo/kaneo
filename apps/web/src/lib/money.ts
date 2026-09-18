import { formatMoney } from "./schedule-format";

export { formatMoney };

/** "40,000.50" → 4000050 minor units; null if it is not a plain amount. */
export function parseMoneyInput(input: string): number | null {
  const text = input.trim().replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole = "0", fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** 4000050 → "40000.50", for putting a stored amount back into an input. */
export function moneyToInput(minor: number): string {
  const whole = Math.floor(minor / 100);
  const cents = minor % 100;
  return cents === 0
    ? String(whole)
    : `${whole}.${String(cents).padStart(2, "0")}`;
}
