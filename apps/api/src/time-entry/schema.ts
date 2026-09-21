import { z } from "../openapi";

const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

// Date.parse alone accepts impossible calendar dates like 2024-02-31, so the
// round-trip through UTC getters rejects anything the calendar rolled over.
function isIsoTimestamp(value: string) {
  if (!ISO_TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);

  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

const timestamp = z
  .string()
  .refine(isIsoTimestamp, "Expected an ISO 8601 timestamp")
  .openapi({ format: "date-time", example: "2026-01-31T09:00:00Z" });

export const taskIdParam = z.object({ taskId: z.string() });

export const timeEntryParam = z.object({ id: z.string() });

export const createTimeEntryBody = z.object({
  taskId: z.string(),
  startTime: timestamp,
  endTime: timestamp.openapi({
    description:
      "Manual entries are always closed. Active tracking uses POST /start.",
  }),
  description: z.string().optional(),
  billable: z.boolean().optional().openapi({
    description: "Whether the time is billable. Defaults to true.",
  }),
});

export const startTimeEntryBody = z.object({
  taskId: z.string(),
  description: z.string().optional(),
  billable: z.boolean().optional().openapi({
    description: "Whether the time is billable. Defaults to true.",
  }),
});

export const updateTimeEntryBody = z.object({
  startTime: timestamp.optional(),
  endTime: timestamp.optional(),
  duration: z.number().int().nonnegative().optional().openapi({
    description:
      "Elapsed seconds. When given, the end time is derived as startTime plus this duration.",
  }),
  description: z.string().optional(),
  billable: z.boolean().optional(),
});
