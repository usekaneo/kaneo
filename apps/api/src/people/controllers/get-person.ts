import { HTTPException } from "hono/http-exception";
import { clockedInUserIds, onlineUserIds } from "../../company/presence";
import { effectiveSchedule, parseWorkDays } from "../../company/schedule";
import { getCompanySettings } from "../../company/settings";
import { selectPeople, toPerson } from "./list-people";

async function getPerson(workspaceId: string, userId: string) {
  const [[row], company, clockedIn, online] = await Promise.all([
    selectPeople(workspaceId, userId),
    getCompanySettings(workspaceId),
    clockedInUserIds(workspaceId),
    onlineUserIds(workspaceId),
  ]);

  if (!row) {
    throw new HTTPException(404, { message: "Person not found" });
  }

  return {
    ...toPerson(row, clockedIn, online),
    schedule: effectiveSchedule(company, row),
    overrides: {
      workDays: row.workDays ? parseWorkDays(row.workDays) : null,
      workStart: row.workStart,
      workEnd: row.workEnd,
      breakMinutes: row.breakMinutes,
    },
  };
}

export default getPerson;
