import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/cn";

export type Series = { key: string; label: string; color: string };

type Point = { day: string } & Record<string, number | string>;

/** Every day in [from, to], so quiet days show as gaps, not missing bars. */
export function fillDays<T extends { day: string }>(
  from: string,
  to: string,
  rows: T[],
  empty: Omit<T, "day">,
) {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const days: T[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor <= end && days.length < 400) {
    const day = cursor.toISOString().slice(0, 10);
    days.push(byDay.get(day) ?? ({ day, ...empty } as T));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function shortDay(day: string, locale: string, span: number) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: span > 45 ? "short" : undefined,
    weekday: span <= 8 ? "short" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
}

/**
 * Daily bars with the recessive grid and axes, 4px rounded tops, a 2px gap
 * between neighbours and a tooltip on hover. Text stays in text colours;
 * only the bars carry the series colour.
 */
export function DailyBars({
  data,
  series,
  locale,
  format = (value) => String(value),
  height = 220,
}: {
  data: Point[];
  series: Series[];
  locale: string;
  format?: (value: number) => string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barGap={2}
          barCategoryGap={data.length > 40 ? 1 : "20%"}
          margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            minTickGap={16}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickFormatter={(day: string) => shortDay(day, locale, data.length)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={48}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickFormatter={(value: number) => format(value)}
          />
          <Tooltip
            cursor={{ fill: "var(--color-accent)", opacity: 0.5 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                  <p className="mb-1 font-medium text-foreground">
                    {new Intl.DateTimeFormat(locale, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    }).format(new Date(`${label}T12:00:00Z`))}
                  </p>
                  {series.map((s) => {
                    const entry = payload.find((p) => p.dataKey === s.key);
                    return (
                      <p
                        key={s.key}
                        className="flex items-center gap-2 text-muted-foreground"
                      >
                        <span
                          className="size-2 rounded-sm"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.label}
                        <span className="ms-auto ps-3 font-medium text-foreground tabular-nums">
                          {format(Number(entry?.value ?? 0))}
                        </span>
                      </p>
                    );
                  })}
                </div>
              ) : null
            }
          />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A legend with a swatch per series: identity never rests on colour alone. */
export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: s.color }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** A value with a thin proportional bar behind it, for tables. */
export function InlineBar({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const share = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${share * 100}%`,
            backgroundColor: "var(--viz-series-1)",
          }}
        />
      </div>
      <span className="w-14 shrink-0 text-right text-sm tabular-nums">
        {label}
      </span>
    </div>
  );
}
