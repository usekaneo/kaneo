import { z } from "../openapi";

export const companySettingsSchema = z
  .object({
    workspaceId: z.string(),
    timezone: z.string(),
    currency: z.string(),
    workDays: z.array(z.number()),
    workStart: z.string(),
    workEnd: z.string(),
    breakMinutes: z.number(),
    lateGraceMinutes: z.number(),
    annualLeaveDays: z.number(),
    overtimeRatePercent: z.number(),
    trackDomains: z.boolean(),
    activityDetailDays: z.number(),
    activitySummaryDays: z.number(),
    autoClock: z.boolean(),
    autoClockIdleMinutes: z.number(),
    autoClockOfflineMinutes: z.number(),
  })
  .openapi("CompanySettings");

export const departmentSchema = z
  .object({ id: z.string(), name: z.string(), memberCount: z.number() })
  .openapi("Department");

export const departmentListSchema = z.array(departmentSchema);
