// Integer microdollars avoid accumulating floating-point rounding errors.
export const USD = 1_000_000n;

export function microUsd(value: string | number, units = 1n): bigint {
  const text = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text))
    throw new Error("Invalid USD amount");
  const [mantissa, exponent = "0"] = text.toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa!.split(".");
  const shift = 6 + Number(exponent) - fraction.length;
  if (Math.abs(shift) > 100) throw new Error("USD amount out of range");
  const digits = BigInt(whole! + fraction) * units;
  if (shift >= 0) return digits * 10n ** BigInt(shift);
  const divisor = 10n ** BigInt(-shift);
  return (digits + divisor - 1n) / divisor;
}

export function applyMargin(amount: bigint, bps: number) {
  return (amount * BigInt(bps) + 9999n) / 10000n;
}

export function pricedMicroUsd(value: string | number, bps: number) {
  return (microUsd(value, BigInt(bps)) + 9999n) / 10000n;
}
