import { z } from "../openapi";

// A real date in a sane range. Day loops (attendance, payroll, reports) walk
// from one of these to another, so "0001-01-01" or "2026-02-31" must never
// reach them.
export const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(
    (value) => {
      const [year, month, day] = value.split("-").map(Number) as [
        number,
        number,
        number,
      ];
      if (year < 2000 || year > 2100) return false;
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    },
    { message: "Use a real date between 2000 and 2100" },
  )
  .openapi({ example: "2026-09-18" });
