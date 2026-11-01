// Reads a typed dollar amount as integer cents without floating point math,
// so "19.99" is exactly 1999. Accepts one "." or "," decimal separator with
// up to two digits; anything else (thousands separators, exponents, signs)
// returns null.
export function parseUsdCents(value: string): number | null {
  const match = /^(\d*)(?:[.,](\d{0,2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  if (!whole && !fraction) return null;
  // Past 15 digits a dollar amount stops being exact as a number, and it is
  // far above any allowed top-up anyway.
  if (whole.length > 15) return null;
  return Number(whole || "0") * 100 + Number(fraction.padEnd(2, "0"));
}
