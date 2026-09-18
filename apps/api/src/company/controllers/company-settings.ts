import { HTTPException } from "hono/http-exception";
import { recordAudit } from "../../audit/record-audit";
import db from "../../database";
import { companySettingsTable } from "../../database/schema";
import { parseWorkDays } from "../schedule";
import { type CompanySettings, getCompanySettings } from "../settings";

function present(settings: CompanySettings) {
  const { updatedAt: _updatedAt, workDays, ...rest } = settings;
  return { ...rest, workDays: parseWorkDays(workDays) };
}

export async function readCompanySettings(workspaceId: string) {
  return present(await getCompanySettings(workspaceId));
}

// Fields older clients don't send are kept as they are.
type Kept =
  | "lateGraceMinutes"
  | "autoClock"
  | "autoClockIdleMinutes"
  | "autoClockOfflineMinutes";
type UpdateInput = Omit<ReturnType<typeof present>, "workspaceId" | Kept> &
  Partial<Pick<ReturnType<typeof present>, Kept>>;

export async function updateCompanySettings(
  workspaceId: string,
  actorId: string,
  input: UpdateInput,
) {
  const before = present(await getCompanySettings(workspaceId));
  const values = {
    ...input,
    lateGraceMinutes: input.lateGraceMinutes ?? before.lateGraceMinutes,
    autoClock: input.autoClock ?? before.autoClock,
    autoClockIdleMinutes:
      input.autoClockIdleMinutes ?? before.autoClockIdleMinutes,
    autoClockOfflineMinutes:
      input.autoClockOfflineMinutes ?? before.autoClockOfflineMinutes,
    workDays: [...new Set(input.workDays)].sort().join(","),
  };

  const [saved] = await db
    .insert(companySettingsTable)
    .values({ workspaceId, ...values })
    .onConflictDoUpdate({
      target: companySettingsTable.workspaceId,
      set: values,
    })
    .returning();
  if (!saved) {
    throw new HTTPException(500, {
      message: "Failed to save company settings",
    });
  }

  const after = present(saved);
  const changed = Object.fromEntries(
    (Object.keys(after) as (keyof typeof after)[])
      .filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]))
      .map((k) => [k, { from: before[k], to: after[k] }]),
  );
  if (Object.keys(changed).length > 0) {
    await recordAudit({
      workspaceId,
      actorId,
      action: "company_settings.updated",
      targetType: "company_settings",
      targetId: workspaceId,
      data: changed,
    });
  }

  return after;
}
