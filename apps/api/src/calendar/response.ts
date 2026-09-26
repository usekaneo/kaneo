import { responseTimestamp, z } from "../openapi";

export const holidaySchema = z
  .object({
    id: z.string(),
    date: responseTimestamp,
    name: z.string(),
  })
  .openapi("WorkspaceHoliday");

export const workspaceCalendarSchema = z
  .object({
    workingDays: z.number().openapi({
      description:
        "Bitmask of working weekdays; bit i (i = 0..6, 0 = Sunday) set means weekday i is a working day. Default 62 (Mon-Fri).",
    }),
    holidays: z.array(holidaySchema).openapi({
      description: "Workspace holidays, sorted by date ascending.",
    }),
  })
  .openapi("WorkspaceCalendar");
