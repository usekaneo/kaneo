export function formatTokens(count: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count);
}

// Provider costs are decimal strings; tiny amounts keep more digits.
export function formatCost(usd: string | null, locale: string) {
  if (usd === null) return null;
  const value = Number(usd);
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
  }).format(value);
}

export function formatRunDuration(
  startedAt: string,
  finishedAt: string | null,
  locale: string,
) {
  if (!finishedAt) return null;
  const seconds = Math.max(
    0,
    Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000),
  );
  if (!Number.isFinite(seconds)) return null;
  const [value, unit] =
    seconds < 60 ? [seconds, "second"] : [Math.round(seconds / 60), "minute"];
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit,
    unitDisplay: "narrow",
  }).format(value);
}
