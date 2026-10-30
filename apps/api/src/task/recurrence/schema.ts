import { z } from "../../openapi";

const RECURRENCE_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;

// Intl.supportedValuesOf lists canonical zones only; browsers may report
// aliases such as Etc/UTC, which are just as usable.
function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const taskRecurrenceSchema = z
  .object({
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    interval: z.number().int().min(1).max(99).openapi({
      description: "Repeat every this many days, weeks, months, or years.",
    }),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length, {
        message: "Weekdays must be unique",
      })
      .optional()
      .openapi({
        description:
          "Weekly rules only: the days to repeat on, 0 for Sunday to 6 for Saturday. Without them, a weekly rule repeats on the due date's weekday.",
      }),
    timeZone: z
      .string()
      .refine(isTimeZone, { message: "Unknown time zone" })
      .openapi({
        description:
          "IANA time zone used to keep the next due date on the same local day and time.",
      }),
  })
  .refine((rule) => !rule.weekdays || rule.frequency === "weekly", {
    message: "Weekdays only apply to weekly rules",
    path: ["weekdays"],
  })
  .openapi("TaskRecurrence", {
    description:
      "When a task with this rule moves into a final column, the next task is created with its dates moved forward by one interval from the completed task's due date.",
  });

export type TaskRecurrence = z.infer<typeof taskRecurrenceSchema>;
