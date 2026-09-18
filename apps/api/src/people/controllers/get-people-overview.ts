import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { getCompanySettings } from "../../company/settings";
import {
  monthStartDay,
  zonedDay,
  zonedInstant,
} from "../../company/zoned-time";
import db from "../../database";
import {
  attendanceSessionTable,
  columnTable,
  leaveRequestTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { COUNTED } from "../../requests/controllers";

// Per-person numbers for the admin People view: workload, time at work this
// month, and leave this year. One grouped query per source, not per person.
async function getPeopleOverview(workspaceId: string) {
  const company = await getCompanySettings(workspaceId);
  const now = new Date();
  const today = zonedDay(now, company.timezone);
  const monthStart = zonedInstant(
    monthStartDay(today),
    "00:00",
    company.timezone,
  );
  const year = today.slice(0, 4);
  // Raw SQL needs an explicit timestamp; columns are UTC "timestamp".
  const nowSql = sql`${now.toISOString()}::timestamp`;
  const thisYearCounted = sql`${leaveRequestTable.startDate} between ${`${year}-01-01`} and ${`${year}-12-31`} and ${inArray(leaveRequestTable.type, COUNTED)}`;

  const [tasks, attendance, leave] = await Promise.all([
    db
      .select({
        userId: taskTable.userId,
        open: sql<number>`count(*)::int`,
        overdue: sql<number>`count(*) filter (where ${taskTable.dueDate} < ${nowSql})::int`,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .leftJoin(columnTable, eq(columnTable.id, taskTable.columnId))
      .where(
        and(
          eq(projectTable.workspaceId, workspaceId),
          isNull(projectTable.archivedAt),
          ne(taskTable.status, "archived"),
          or(isNull(columnTable.isFinal), eq(columnTable.isFinal, false)),
        ),
      )
      .groupBy(taskTable.userId),
    db
      .select({
        userId: attendanceSessionTable.userId,
        minutes: sql<number>`coalesce(sum(extract(epoch from (coalesce(${attendanceSessionTable.clockOut}, ${nowSql}) - ${attendanceSessionTable.clockIn})) / 60), 0)::int`,
      })
      .from(attendanceSessionTable)
      .where(
        and(
          eq(attendanceSessionTable.workspaceId, workspaceId),
          gte(attendanceSessionTable.clockIn, monthStart),
        ),
      )
      .groupBy(attendanceSessionTable.userId),
    db
      .select({
        userId: leaveRequestTable.userId,
        used: sql<number>`coalesce(sum(${leaveRequestTable.days}) filter (where ${leaveRequestTable.status} = 'approved' and ${thisYearCounted}), 0)::int`,
        pending: sql<number>`coalesce(sum(${leaveRequestTable.days}) filter (where ${leaveRequestTable.status} = 'pending' and ${thisYearCounted}), 0)::int`,
        onLeaveToday: sql<boolean>`bool_or(${leaveRequestTable.status} = 'approved' and ${leaveRequestTable.startDate} <= ${today} and ${leaveRequestTable.endDate} >= ${today})`,
      })
      .from(leaveRequestTable)
      .where(
        and(
          eq(leaveRequestTable.workspaceId, workspaceId),
          inArray(leaveRequestTable.status, ["approved", "pending"]),
          // This year's leave, plus anything still running today.
          or(
            and(
              gte(leaveRequestTable.startDate, `${year}-01-01`),
              lte(leaveRequestTable.startDate, `${year}-12-31`),
            ),
            gte(leaveRequestTable.endDate, today),
          ),
        ),
      )
      .groupBy(leaveRequestTable.userId),
  ]);

  const byUser = new Map<
    string,
    {
      userId: string;
      openTasks: number;
      overdueTasks: number;
      workedMinutesThisMonth: number;
      leaveUsed: number;
      leavePending: number;
      onLeaveToday: boolean;
    }
  >();
  const entry = (userId: string) => {
    let row = byUser.get(userId);
    if (!row) {
      row = {
        userId,
        openTasks: 0,
        overdueTasks: 0,
        workedMinutesThisMonth: 0,
        leaveUsed: 0,
        leavePending: 0,
        onLeaveToday: false,
      };
      byUser.set(userId, row);
    }
    return row;
  };

  for (const row of tasks) {
    if (!row.userId) continue;
    Object.assign(entry(row.userId), {
      openTasks: row.open,
      overdueTasks: row.overdue,
    });
  }
  for (const row of attendance) {
    entry(row.userId).workedMinutesThisMonth = row.minutes;
  }
  for (const row of leave) {
    Object.assign(entry(row.userId), {
      leaveUsed: row.used,
      leavePending: row.pending,
      onLeaveToday: Boolean(row.onLeaveToday),
    });
  }

  return {
    today,
    currency: company.currency,
    leaveAllowance: company.annualLeaveDays,
    unassignedOpenTasks: tasks.find((row) => !row.userId)?.open ?? 0,
    people: [...byUser.values()],
  };
}

export default getPeopleOverview;
