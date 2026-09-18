import { and, eq, type SQL, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { getAttendanceDays } from "../attendance/summary";
import { getCompanySettings } from "../company/settings";
import { addDays, zonedDay, zonedDayRange } from "../company/zoned-time";
import db from "../database";
import { userTable, workspaceUserTable } from "../database/schema";

export type ReportScope = {
  workspaceId: string;
  from: string;
  to: string;
  projectId?: string;
  /** Only this person's work; everyone when absent. */
  userId?: string;
};

const MAX_DAYS = 366;

async function window(scope: ReportScope) {
  if (scope.to < scope.from) {
    throw new HTTPException(400, {
      message: "The range ends before it starts",
    });
  }
  if (addDays(scope.from, MAX_DAYS) <= scope.to) {
    throw new HTTPException(400, { message: "Pick at most a year" });
  }
  const company = await getCompanySettings(scope.workspaceId);
  const timeZone = company.timezone;
  return {
    timeZone,
    currency: company.currency,
    start: utc(zonedDayRange(scope.from, timeZone).start),
    end: utc(zonedDayRange(scope.to, timeZone).end),
    endDate: zonedDayRange(scope.to, timeZone).end,
  };
}

/** Local calendar day of a naive-UTC timestamp column. */
const localDay = (column: SQL, timeZone: string) =>
  sql`((${column} at time zone 'UTC') at time zone ${timeZone})::date::text`;

const utcNow = sql`(now() at time zone 'utc')`;

// Columns hold naive UTC, and raw queries skip Drizzle's column mapping: a
// Date parameter would go out in the server's zone and lose its offset, and a
// naive timestamp would be read back as local time. So pass UTC text in and
// select "at time zone 'UTC'" (timestamptz) out.
const utc = (date: Date) =>
  sql`${date.toISOString().replace("T", " ").replace("Z", "")}::timestamp`;

// Seconds an entry counts for: its recorded duration, or up to now (at most
// a day) while it runs.
const entrySeconds = sql`case when te.end_time is not null then coalesce(te.duration, 0)
  else least(extract(epoch from ${utcNow} - te.start_time), 86400)::int end`;

type Row = Record<string, unknown>;

async function rows<T extends Row>(query: SQL) {
  return (await db.execute<T>(query)).rows;
}

const n = (value: unknown) => Number(value ?? 0);

export async function taskReport(scope: ReportScope) {
  const { timeZone, start, end } = await window(scope);
  const where = sql`p.workspace_id = ${scope.workspaceId}
    and t.status <> 'archived'
    ${scope.projectId ? sql`and t.project_id = ${scope.projectId}` : sql``}
    ${scope.userId ? sql`and t.assignee_id = ${scope.userId}` : sql``}`;
  const inRange = (column: SQL) =>
    sql`${column} >= ${start} and ${column} < ${end}`;

  const [totals] = await rows<{
    created: string;
    completed: string;
    open: string;
    overdue: string;
    cycle: string | null;
  }>(sql`
    select
      count(*) filter (where ${inRange(sql`t.created_at`)}) as created,
      count(*) filter (where ${inRange(sql`t.completed_at`)}) as completed,
      count(*) filter (where t.completed_at is null) as open,
      count(*) filter (where t.completed_at is null and t.due_date < ${utcNow}) as overdue,
      avg(extract(epoch from t.completed_at - t.created_at))
        filter (where ${inRange(sql`t.completed_at`)}) as cycle
    from task t join project p on p.id = t.project_id
    where ${where}`);

  const series = await rows<{
    day: string;
    created: string;
    completed: string;
  }>(sql`
    select day, sum(created) as created, sum(completed) as completed from (
      select ${localDay(sql`t.created_at`, timeZone)} as day, 1 as created, 0 as completed
      from task t join project p on p.id = t.project_id
      where ${where} and ${inRange(sql`t.created_at`)}
      union all
      select ${localDay(sql`t.completed_at`, timeZone)}, 0, 1
      from task t join project p on p.id = t.project_id
      where ${where} and ${inRange(sql`t.completed_at`)}
    ) days group by day order by day`);

  const byPerson = await rows<{
    user_id: string | null;
    name: string | null;
    image: string | null;
    open: string;
    completed: string;
    overdue: string;
  }>(sql`
    select t.assignee_id as user_id, u.name, u.image,
      count(*) filter (where t.completed_at is null) as open,
      count(*) filter (where ${inRange(sql`t.completed_at`)}) as completed,
      count(*) filter (where t.completed_at is null and t.due_date < ${utcNow}) as overdue
    from task t join project p on p.id = t.project_id
    left join "user" u on u.id = t.assignee_id
    where ${where}
    group by t.assignee_id, u.name, u.image
    order by completed desc, open desc`);

  const byProject = await rows<{
    project_id: string;
    name: string;
    created: string;
    completed: string;
    open: string;
    overdue: string;
  }>(sql`
    select p.id as project_id, p.name,
      count(*) filter (where ${inRange(sql`t.created_at`)}) as created,
      count(*) filter (where ${inRange(sql`t.completed_at`)}) as completed,
      count(*) filter (where t.completed_at is null) as open,
      count(*) filter (where t.completed_at is null and t.due_date < ${utcNow}) as overdue
    from task t join project p on p.id = t.project_id
    where ${where}
    group by p.id, p.name
    order by open desc, completed desc`);

  const overdueList = await rows<{
    id: string;
    number: number | null;
    title: string;
    due_date: Date;
    project_id: string;
    project_name: string;
    assignee_name: string | null;
  }>(sql`
    select t.id, t.number, t.title, t.due_date at time zone 'UTC' as due_date,
      p.id as project_id,
      p.name as project_name, u.name as assignee_name
    from task t join project p on p.id = t.project_id
    left join "user" u on u.id = t.assignee_id
    where ${where} and t.completed_at is null and t.due_date < ${utcNow}
    order by t.due_date asc limit 20`);

  return {
    created: n(totals?.created),
    completed: n(totals?.completed),
    open: n(totals?.open),
    overdue: n(totals?.overdue),
    averageCycleHours:
      totals?.cycle === null || totals?.cycle === undefined
        ? null
        : Math.round((Number(totals.cycle) / 3600) * 10) / 10,
    series: series.map((r) => ({
      day: r.day,
      created: n(r.created),
      completed: n(r.completed),
    })),
    byPerson: byPerson.map((r) => ({
      userId: r.user_id,
      name: r.name,
      image: r.image,
      open: n(r.open),
      completed: n(r.completed),
      overdue: n(r.overdue),
    })),
    byProject: byProject.map((r) => ({
      projectId: r.project_id,
      name: r.name,
      created: n(r.created),
      completed: n(r.completed),
      open: n(r.open),
      overdue: n(r.overdue),
    })),
    overdueTasks: overdueList.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      dueDate: new Date(r.due_date),
      projectId: r.project_id,
      projectName: r.project_name,
      assigneeName: r.assignee_name,
    })),
  };
}

export async function timeReport(scope: ReportScope) {
  const { timeZone, start, end } = await window(scope);
  const where = sql`p.workspace_id = ${scope.workspaceId}
    and te.start_time >= ${start} and te.start_time < ${end}
    ${scope.projectId ? sql`and t.project_id = ${scope.projectId}` : sql``}
    ${scope.userId ? sql`and te.user_id = ${scope.userId}` : sql``}`;
  const from = sql`time_entry te join task t on t.id = te.task_id
    join project p on p.id = t.project_id`;

  const [byDay, byPerson, byProject] = await Promise.all([
    rows<{ day: string; seconds: string }>(sql`
      select ${localDay(sql`te.start_time`, timeZone)} as day, sum(${entrySeconds}) as seconds
      from ${from} where ${where} group by day order by day`),
    rows<{ user_id: string | null; name: string | null; seconds: string }>(sql`
      select te.user_id, u.name, sum(${entrySeconds}) as seconds
      from ${from} left join "user" u on u.id = te.user_id
      where ${where} group by te.user_id, u.name order by seconds desc`),
    rows<{ project_id: string; name: string; seconds: string }>(sql`
      select p.id as project_id, p.name, sum(${entrySeconds}) as seconds
      from ${from} where ${where} group by p.id, p.name order by seconds desc`),
  ]);

  return {
    trackedSeconds: byDay.reduce((sum, r) => sum + n(r.seconds), 0),
    byDay: byDay.map((r) => ({ day: r.day, seconds: n(r.seconds) })),
    byPerson: byPerson.map((r) => ({
      userId: r.user_id,
      name: r.name,
      seconds: n(r.seconds),
    })),
    byProject: byProject.map((r) => ({
      projectId: r.project_id,
      name: r.name,
      seconds: n(r.seconds),
    })),
  };
}

export async function attendanceReport(scope: ReportScope) {
  const { timeZone } = await window(scope);
  const members = await db
    .select({ userId: workspaceUserTable.userId, name: userTable.name })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(
      and(
        eq(workspaceUserTable.workspaceId, scope.workspaceId),
        scope.userId ? eq(workspaceUserTable.userId, scope.userId) : undefined,
      ),
    )
    .orderBy(userTable.name);

  const today = zonedDay(new Date(), timeZone);
  // Attendance for days that haven't happened yet is all "upcoming".
  const to = scope.to > today ? today : scope.to;
  const people =
    scope.from > to
      ? []
      : await Promise.all(
          members.map(async (member) => {
            const { totals } = await getAttendanceDays(
              scope.workspaceId,
              member.userId,
              scope.from,
              to,
            );
            return {
              userId: member.userId,
              name: member.name,
              presentDays: totals.presentDays,
              lateDays: totals.lateDays,
              absentDays: totals.absentDays,
              leaveDays: totals.leaveDays,
              workedMinutes: totals.workedMinutes,
              overtimeMinutes: totals.overtimeMinutes,
            };
          }),
        );

  const sum = (key: keyof (typeof people)[number]) =>
    people.reduce((total, p) => total + Number(p[key] ?? 0), 0);
  return {
    people,
    totals: {
      presentDays: sum("presentDays"),
      lateDays: sum("lateDays"),
      absentDays: sum("absentDays"),
      leaveDays: sum("leaveDays"),
      workedMinutes: sum("workedMinutes"),
      overtimeMinutes: sum("overtimeMinutes"),
    },
  };
}

export async function requestsReport(
  scope: ReportScope,
  { showMoney }: { showMoney: boolean },
) {
  const { currency } = await window(scope);
  const person = scope.userId ? sql`and user_id = ${scope.userId}` : sql``;
  const [leave, expenses] = await Promise.all([
    rows<{ type: string; status: string; requests: string; days: string }>(sql`
      select type, status, count(*) as requests, sum(days) as days
      from leave_request
      where workspace_id = ${scope.workspaceId}
        and start_date >= ${scope.from} and start_date <= ${scope.to} ${person}
      group by type, status`),
    rows<{
      category: string;
      status: string;
      count: string;
      amount: string;
    }>(sql`
      select category, status, count(*) as count, sum(amount) as amount
      from expense
      where workspace_id = ${scope.workspaceId}
        and spent_on >= ${scope.from} and spent_on <= ${scope.to} ${person}
      group by category, status`),
  ]);

  const leaveByType = new Map<string, number>();
  const leaveByStatus = new Map<string, number>();
  for (const row of leave) {
    if (row.status === "approved") {
      leaveByType.set(row.type, (leaveByType.get(row.type) ?? 0) + n(row.days));
    }
    leaveByStatus.set(
      row.status,
      (leaveByStatus.get(row.status) ?? 0) + n(row.requests),
    );
  }
  const byCategory = new Map<string, number>();
  const expenseByStatus = new Map<string, { count: number; amount: number }>();
  for (const row of expenses) {
    if (row.status !== "rejected") {
      byCategory.set(
        row.category,
        (byCategory.get(row.category) ?? 0) + n(row.amount),
      );
    }
    const current = expenseByStatus.get(row.status) ?? { count: 0, amount: 0 };
    expenseByStatus.set(row.status, {
      count: current.count + n(row.count),
      amount: current.amount + n(row.amount),
    });
  }

  return {
    leave: {
      approvedDaysByType: [...leaveByType].map(([type, days]) => ({
        type,
        days,
      })),
      requestsByStatus: [...leaveByStatus].map(([status, count]) => ({
        status,
        count,
      })),
    },
    expenses: showMoney
      ? {
          currency,
          byCategory: [...byCategory]
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount),
          byStatus: [...expenseByStatus].map(([status, value]) => ({
            status,
            ...value,
          })),
        }
      : null,
  };
}

// ------------------------------------------------------------ activity feed

export type FeedFilters = ReportScope & {
  before?: Date;
  includeAudit: boolean;
  limit?: number;
};

/**
 * Task history and HR decisions as one timeline, newest first. Task events
 * come from `activity`; approvals and edits from `audit_log`.
 */
export async function activityFeed(filters: FeedFilters) {
  const { start, end, endDate } = await window(filters);
  const limit = Math.min(filters.limit ?? 50, 100);
  const upper =
    filters.before && filters.before < endDate ? utc(filters.before) : end;

  const taskEvents = sql`
    select a.id, 'task' as source, a.type as action,
      a.created_at at time zone 'UTC' as created_at,
      a.user_id as actor_id, coalesce(u.name, a.external_user_name) as actor_name,
      a.event_data as data, left(a.content, 200) as content,
      t.id as task_id, t.number as task_number, t.title as task_title,
      p.id as project_id, p.name as project_name
    from activity a
    join task t on t.id = a.task_id
    join project p on p.id = t.project_id
    left join "user" u on u.id = a.user_id
    where p.workspace_id = ${filters.workspaceId}
      and a.created_at >= ${start} and a.created_at < ${upper}
      ${filters.projectId ? sql`and p.id = ${filters.projectId}` : sql``}
      ${filters.userId ? sql`and a.user_id = ${filters.userId}` : sql``}`;

  const auditEvents = sql`
    select l.id, 'audit' as source, l.action,
      l.created_at at time zone 'UTC' as created_at,
      l.actor_id, u.name as actor_name,
      jsonb_build_object('targetType', l.target_type, 'targetName', tu.name) as data,
      null as content,
      null as task_id, null as task_number, null as task_title,
      null as project_id, null as project_name
    from audit_log l
    left join "user" u on u.id = l.actor_id
    left join "user" tu on l.target_type = 'user' and tu.id = l.target_id
    where l.workspace_id = ${filters.workspaceId}
      and l.created_at >= ${start} and l.created_at < ${upper}
      ${filters.userId ? sql`and (l.actor_id = ${filters.userId} or (l.target_type = 'user' and l.target_id = ${filters.userId}))` : sql``}`;

  const union =
    filters.includeAudit && !filters.projectId
      ? sql`${taskEvents} union all ${auditEvents}`
      : taskEvents;

  const result = await rows<{
    id: string;
    source: "task" | "audit";
    action: string;
    created_at: Date;
    actor_id: string | null;
    actor_name: string | null;
    data: Record<string, unknown> | null;
    content: string | null;
    task_id: string | null;
    task_number: number | null;
    task_title: string | null;
    project_id: string | null;
    project_name: string | null;
  }>(
    sql`select * from (${union}) feed order by created_at desc limit ${limit + 1}`,
  );

  const page = result.slice(0, limit);
  return {
    items: page.map((r) => ({
      id: r.id,
      source: r.source,
      action: r.action,
      createdAt: new Date(r.created_at),
      actorId: r.actor_id,
      actorName: r.actor_name,
      data: r.data,
      content: r.content,
      taskId: r.task_id,
      taskNumber: r.task_number,
      taskTitle: r.task_title,
      projectId: r.project_id,
      projectName: r.project_name,
    })),
    nextBefore:
      result.length > limit && page.length > 0
        ? new Date((page[page.length - 1] as { created_at: Date }).created_at)
        : null,
  };
}
