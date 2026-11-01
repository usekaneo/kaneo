type Options = { maxDigits?: number; minDigits?: number; signed?: boolean };

// Amounts arrive as microdollar strings. Ledger rows pass `maxDigits: 6`
// because single requests often cost a fraction of a cent.
export function formatAiCredit(
  value: string,
  locale: string,
  { maxDigits, minDigits = 2, signed = false }: Options = {},
) {
  const dollars = Number(value) / 1e6;
  // Whole cents read best; only show more digits when a nonzero balance
  // would otherwise display as $0.00.
  const digits =
    maxDigits ??
    (dollars !== 0 && Math.abs(dollars) < 0.0001
      ? 6
      : dollars !== 0 && Math.abs(dollars) < 0.01
        ? 4
        : 2);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: minDigits,
    maximumFractionDigits: digits,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(dollars);
}
