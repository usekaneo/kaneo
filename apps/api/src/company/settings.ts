import { eq } from "drizzle-orm";
import db from "../database";
import { companySettingsTable } from "../database/schema";

export type CompanySettings = typeof companySettingsTable.$inferSelect;

// Mirrors the column defaults so a workspace that never opened company
// settings behaves exactly as if it had saved them.
export function defaultCompanySettings(workspaceId: string): CompanySettings {
  return {
    workspaceId,
    timezone: "UTC",
    currency: "USD",
    workDays: "1,2,3,4,5",
    workStart: "09:00",
    workEnd: "17:00",
    breakMinutes: 60,
    lateGraceMinutes: 10,
    annualLeaveDays: 15,
    overtimeRatePercent: 100,
    trackDomains: true,
    activityDetailDays: 90,
    activitySummaryDays: 365,
    autoClock: false,
    autoClockIdleMinutes: 15,
    autoClockOfflineMinutes: 10,
    updatedAt: new Date(0),
  };
}

export async function getCompanySettings(
  workspaceId: string,
): Promise<CompanySettings> {
  const [row] = await db
    .select()
    .from(companySettingsTable)
    .where(eq(companySettingsTable.workspaceId, workspaceId));
  return row ?? defaultCompanySettings(workspaceId);
}
