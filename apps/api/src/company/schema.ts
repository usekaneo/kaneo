import { z } from "../openapi";
import { isValidTimeZone } from "./zoned-time";

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM")
  .openapi({ example: "10:00" });

export const workspaceQuery = z.object({ workspaceId: z.string() });

export const updateCompanySettingsBody = z
  .object({
    workspaceId: z.string(),
    timezone: z
      .string()
      .refine(isValidTimeZone, "Unknown timezone")
      .openapi({ example: "Asia/Dhaka" }),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter ISO currency code")
      .openapi({ example: "BDT" }),
    workDays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .openapi({ description: "ISO weekdays, 1 = Monday to 7 = Sunday." }),
    workStart: clockTime,
    workEnd: clockTime,
    breakMinutes: z.number().int().min(0).max(240),
    lateGraceMinutes: z.number().int().min(0).max(240).optional().openapi({
      description:
        "Minutes after the start of the day someone can clock in and still be on time. Kept as is when left out.",
    }),
    annualLeaveDays: z.number().int().min(0).max(365),
    overtimeRatePercent: z.number().int().min(0).max(500).openapi({
      description: "Overtime pay as a percentage of the hourly rate.",
    }),
    trackDomains: z.boolean(),
    activityDetailDays: z.number().int().min(7).max(365),
    activitySummaryDays: z.number().int().min(30).max(1095),
    autoClock: z.boolean().optional().openapi({
      description:
        "Clock people in and out from the desktop app's activity. Kept as is when left out.",
    }),
    autoClockIdleMinutes: z.number().int().min(5).max(240).optional().openapi({
      description:
        "Clock out after this many minutes without keyboard or mouse activity.",
    }),
    autoClockOfflineMinutes: z
      .number()
      .int()
      .min(3)
      .max(240)
      .optional()
      .openapi({
        description:
          "Clock out after this many minutes without hearing from any of the person's devices.",
      }),
  })
  .refine((b) => b.workEnd > b.workStart, {
    message: "The work day must end after it starts",
    path: ["workEnd"],
  })
  .refine((b) => b.activitySummaryDays >= b.activityDetailDays, {
    message: "Summaries must be kept at least as long as details",
    path: ["activitySummaryDays"],
  });

export const createDepartmentBody = z.object({
  workspaceId: z.string(),
  name: z.string().trim().min(1).max(80),
});

export const departmentParam = z.object({ id: z.string() });
