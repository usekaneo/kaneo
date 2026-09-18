import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { getTeamDay } from "../attendance/controllers";
import { clockedInUserIds, onlineUserIds } from "../company/presence";
import { getCompanySettings } from "../company/settings";
import { zonedDay, zonedDayRange } from "../company/zoned-time";
import db from "../database";
import {
  auditLogTable,
  columnTable,
  leaveRequestTable,
  payrollRunTable,
  projectTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  nullableResponseTimestamp,
  responseTimestamp,
  z,
} from "../openapi";
import { timestamp } from "../time-entry/schema";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";

const companyTodaySchema = z
  .object({
    people: z.number(),
    present: z.number().openapi({
      description: "Clocked in, or with the desktop app online.",
    }),
    tasksDueToday: z.number(),
    overdueTasks: z.number(),
    workedMinutesToday: z.number(),
    pendingLeave: z.number(),
    openPayrolls: z.number().nullable().openapi({
      description:
        "Draft or approved payrolls not yet paid. Null without payroll:read.",
    }),
  })
  .openapi("CompanyToday");

const auditEntrySchema = z
  .object({
    id: z.string(),
    actorName: z.string().nullable(),
    action: z.string(),
    targetType: z.string(),
    targetId: z.string().nullable(),
    targetName: z.string().nullable(),
    data: z.unknown().nullable(),
    createdAt: responseTimestamp,
  })
  .openapi("AuditEntry");

const companyTodayRoute = createRoute({
  method: "get",
  operationId: "getCompanyToday",
  path: "/company",
  tags: ["Overview"],
  summary: "Company today",
  description:
    "The handful of numbers an admin checks first: who is here, what is due, and what is waiting.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ people: ["read_all"] }),
  ] as const,
  request: { query: z.object({ workspaceId: z.string() }) },
  responses: {
    200: jsonResponse("Today", companyTodaySchema),
    403: errorResponse("Missing people:read_all"),
  },
});

const auditRoute = createRoute({
  method: "get",
  operationId: "listAuditLog",
  path: "/audit",
  tags: ["Overview"],
  summary: "Audit log",
  description:
    "Important changes (pay, payroll, roles, people, approvals, devices), newest first.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ audit: ["read"] }),
  ] as const,
  request: {
    query: z.object({
      workspaceId: z.string(),
      before: timestamp.optional().openapi({
        description: "Only entries older than this ISO time (paging).",
      }),
    }),
  },
  responses: {
    200: jsonResponse(
      "Entries",
      z.object({
        entries: z.array(auditEntrySchema),
        nextBefore: nullableResponseTimestamp,
      }),
    ),
    403: errorResponse("Missing audit:read"),
  },
});

const PAGE = 100;

const overview = apiRouter()
  .openapi(companyTodayRoute, async (c) => {
    const { workspaceId } = c.req.valid("query");
    const company = await getCompanySettings(workspaceId);
    const today = zonedDay(new Date(), company.timezone);
    const { start, end } = zonedDayRange(today, company.timezone);

    const openTask = and(
      eq(projectTable.workspaceId, workspaceId),
      ne(taskTable.status, "archived"),
      or(isNull(columnTable.isFinal), eq(columnTable.isFinal, false)),
    );
    const taskCount = (extra: ReturnType<typeof and>) =>
      db
        .select({ n: count() })
        .from(taskTable)
        .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
        .leftJoin(columnTable, eq(columnTable.id, taskTable.columnId))
        .where(and(openTask, extra))
        .then((r) => r[0]?.n ?? 0);

    const [
      [people],
      clockedIn,
      online,
      dueToday,
      overdue,
      team,
      [pendingLeave],
      [openPayrolls],
    ] = await Promise.all([
      db
        .select({ n: count() })
        .from(workspaceUserTable)
        .where(eq(workspaceUserTable.workspaceId, workspaceId)),
      clockedInUserIds(workspaceId),
      onlineUserIds(workspaceId),
      taskCount(
        and(sql`${taskTable.dueDate} >= ${start}`, lt(taskTable.dueDate, end)),
      ),
      taskCount(lt(taskTable.dueDate, start)),
      getTeamDay(workspaceId, today),
      db
        .select({ n: count() })
        .from(leaveRequestTable)
        .where(
          and(
            eq(leaveRequestTable.workspaceId, workspaceId),
            eq(leaveRequestTable.status, "pending"),
          ),
        ),
      db
        .select({ n: count() })
        .from(payrollRunTable)
        .where(
          and(
            eq(payrollRunTable.workspaceId, workspaceId),
            inArray(payrollRunTable.status, ["draft", "approved"]),
          ),
        ),
    ]);

    return c.json(
      {
        people: people?.n ?? 0,
        present: new Set([...clockedIn, ...online]).size,
        tasksDueToday: dueToday,
        overdueTasks: overdue,
        workedMinutesToday: team.reduce((sum, p) => sum + p.workedMinutes, 0),
        pendingLeave: pendingLeave?.n ?? 0,
        // Payroll is private even as a count: managers see people, not pay.
        openPayrolls: (await hasWorkspacePermission(c, { payroll: ["read"] }))
          ? (openPayrolls?.n ?? 0)
          : null,
      },
      200,
    );
  })
  .openapi(auditRoute, async (c) => {
    const { workspaceId, before } = c.req.valid("query");
    const target = sql<
      string | null
    >`(select name from "user" where id = ${auditLogTable.targetId})`;
    const rows = await db
      .select({
        id: auditLogTable.id,
        actorName: userTable.name,
        action: auditLogTable.action,
        targetType: auditLogTable.targetType,
        targetId: auditLogTable.targetId,
        targetName: target,
        data: auditLogTable.data,
        createdAt: auditLogTable.createdAt,
      })
      .from(auditLogTable)
      .leftJoin(userTable, eq(userTable.id, auditLogTable.actorId))
      .where(
        and(
          eq(auditLogTable.workspaceId, workspaceId),
          before ? lt(auditLogTable.createdAt, new Date(before)) : undefined,
        ),
      )
      .orderBy(desc(auditLogTable.createdAt))
      .limit(PAGE);
    const last = rows[rows.length - 1];
    // Audit readers aren't necessarily allowed to see pay: amounts in salary
    // and payroll entries stay hidden without payroll:read.
    const seesPay = await hasWorkspacePermission(c, { payroll: ["read"] });
    const entries = seesPay
      ? rows
      : rows.map((row) =>
          /^(salary|payroll)\./.test(row.action) ? { ...row, data: null } : row,
        );
    return c.json(
      {
        entries,
        nextBefore: rows.length === PAGE && last ? last.createdAt : null,
      },
      200,
    );
  });

export default overview;
