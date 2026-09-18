// ISO weekdays: 1 = Monday … 7 = Sunday. 2024-01-01 was a Monday.
export function weekdayName(
  isoDay: number,
  locale: string,
  width: "short" | "narrow" = "short",
) {
  return new Intl.DateTimeFormat(locale, { weekday: width }).format(
    new Date(Date.UTC(2024, 0, isoDay, 12)),
  );
}

// "Mon–Fri" (or "Sun–Thu", wrapping the week) for a run of consecutive days,
// "Mon, Wed, Fri" otherwise.
export function describeWorkDays(days: number[], locale: string) {
  const set = new Set(days.filter((d) => d >= 1 && d <= 7));
  if (set.size === 0) return "";
  if (set.size > 2 && set.size < 7) {
    // A run starts at the one selected day whose previous day is not selected.
    const starts = [...set].filter((d) => !set.has(d === 1 ? 7 : d - 1));
    if (starts.length === 1) {
      const first = starts[0] as number;
      const last = ((first + set.size - 2) % 7) + 1;
      return `${weekdayName(first, locale)}–${weekdayName(last, locale)}`;
    }
  }
  return [...set]
    .sort((a, b) => a - b)
    .map((d) => weekdayName(d, locale))
    .join(", ");
}

export function describeSchedule(
  schedule: { workDays: number[]; workStart: string; workEnd: string },
  locale: string,
) {
  return `${describeWorkDays(schedule.workDays, locale)} · ${schedule.workStart}–${schedule.workEnd}`;
}

export function formatMoney(minor: number, currency: string, locale: string) {
  try {
    // narrowSymbol shows ৳ or $ rather than "BDT" or "US$".
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}
