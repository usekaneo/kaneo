import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { calendarDay } from "../company/calendar-day";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  nullableResponseTimestamp,
  responseTimestamp,
  z,
} from "../openapi";
import { hasWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  activityFeed,
  attendanceReport,
  type ReportScope,
  requestsReport,
  taskReport,
  timeReport,
} from "./controllers";

const tags = ["Reports"];

const scopeQuery = z.object({
  workspaceId: z.string(),
  from: calendarDay,
  to: calendarDay,
  projectId: z.string().optional(),
  userId: z.string().optional().openapi({
    description:
      "One person's work. Without report:read this is always you, and asking for someone else is refused.",
  }),
});

const count = z.number();

const summarySchema = z
  .object({
    scope: z.object({
      userId: z.string().nullable(),
      team: z.boolean().openapi({
        description: "Whether the caller may see everyone (report:read).",
      }),
    }),
    tasks: z.object({
      created: count,
      completed: count,
      open: count,
      overdue: count,
      averageCycleHours: z.number().nullable(),
      series: z.array(
        z.object({ day: z.string(), created: count, completed: count }),
      ),
      byPerson: z.array(
        z.object({
          userId: z.string().nullable(),
          name: z.string().nullable(),
          image: z.string().nullable(),
          open: count,
          completed: count,
          overdue: count,
        }),
      ),
      byProject: z.array(
        z.object({
          projectId: z.string(),
          name: z.string(),
          created: count,
          completed: count,
          open: count,
          overdue: count,
        }),
      ),
      overdueTasks: z.array(
        z.object({
          id: z.string(),
          number: z.number().nullable(),
          title: z.string(),
          dueDate: responseTimestamp,
          projectId: z.string(),
          projectName: z.string(),
          assigneeName: z.string().nullable(),
        }),
      ),
    }),
    time: z.object({
      trackedSeconds: count,
      byDay: z.array(z.object({ day: z.string(), seconds: count })),
      byPerson: z.array(
        z.object({
          userId: z.string().nullable(),
          name: z.string().nullable(),
          seconds: count,
        }),
      ),
      byProject: z.array(
        z.object({ projectId: z.string(), name: z.string(), seconds: count }),
      ),
    }),
    attendance: z.object({
      people: z.array(
        z.object({
          userId: z.string(),
          name: z.string(),
          presentDays: count,
          lateDays: count,
          absentDays: count,
          leaveDays: count,
          workedMinutes: count,
          overtimeMinutes: count,
        }),
      ),
      totals: z.object({
        presentDays: count,
        lateDays: count,
        absentDays: count,
        leaveDays: count,
        workedMinutes: count,
        overtimeMinutes: count,
      }),
    }),
    leave: z.object({
      approvedDaysByType: z.array(z.object({ type: z.string(), days: count })),
      requestsByStatus: z.array(z.object({ status: z.string(), count: count })),
    }),
    expenses: z
      .object({
        currency: z.string(),
        byCategory: z.array(z.object({ category: z.string(), amount: count })),
        byStatus: z.array(
          z.object({ status: z.string(), count: count, amount: count }),
        ),
      })
      .nullable()
      .openapi({
        description:
          "Amounts in minor units. Null for people who may not see others' money.",
      }),
  })
  .openapi("ReportSummary");

const feedSchema = z
  .object({
    items: z.array(
      z.object({
        id: z.string(),
        source: z.enum(["task", "audit"]),
        action: z.string(),
        createdAt: responseTimestamp,
        actorId: z.string().nullable(),
        actorName: z.string().nullable(),
        data: z.record(z.string(), z.unknown()).nullable(),
        content: z.string().nullable(),
        taskId: z.string().nullable(),
        taskNumber: z.number().nullable(),
        taskTitle: z.string().nullable(),
        projectId: z.string().nullable(),
        projectName: z.string().nullable(),
      }),
    ),
    nextBefore: nullableResponseTimestamp,
  })
  .openapi("ReportActivity");

const summaryRoute = createRoute({
  method: "get",
  operationId: "getReportSummary",
  path: "/summary",
  tags,
  summary: "Workspace report",
  description:
    "Tasks, time, attendance, leave and expenses for a date range, in the workspace timezone. Everyone can see their own; the whole team needs report:read.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: scopeQuery },
  responses: {
    200: jsonResponse("Report", summarySchema),
    400: errorResponse("Bad range"),
    403: errorResponse("Someone else's report without report:read"),
  },
});

const activityRoute = createRoute({
  method: "get",
  operationId: "getReportActivity",
  path: "/activity",
  tags,
  summary: "Activity timeline",
  description:
    "Who did what, newest first: task changes and comments, plus approvals and edits for people with audit:read. Page with `before`.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: {
    query: scopeQuery.extend({
      before: z.string().datetime().optional(),
    }),
  },
  responses: {
    200: jsonResponse("Timeline", feedSchema),
    403: errorResponse("Someone else's activity without report:read"),
  },
});

/** Team reports need report:read; anyone may see their own. */
async function resolveScope(
  c: Context,
  query: ReportScope,
): Promise<{ scope: ReportScope; team: boolean }> {
  const team = await hasWorkspacePermission(c, { report: ["read"] });
  const self = c.get("userId") as string;
  if (!team && query.userId && query.userId !== self) {
    throw new HTTPException(403, {
      message: "You can only see your own report",
    });
  }
  return {
    team,
    scope: { ...query, userId: team ? query.userId : self },
  };
}

const reports = apiRouter()
  .openapi(summaryRoute, async (c) => {
    const { scope, team } = await resolveScope(c, c.req.valid("query"));
    const showMoney =
      !team ||
      (await hasWorkspacePermission(c, { request: ["approve"] })) ||
      (await hasWorkspacePermission(c, { payroll: ["read"] }));
    const [tasks, time, attendance, requests] = await Promise.all([
      taskReport(scope),
      timeReport(scope),
      attendanceReport(scope),
      requestsReport(scope, { showMoney }),
    ]);
    return c.json(
      {
        scope: { userId: scope.userId ?? null, team },
        tasks,
        time,
        attendance,
        leave: requests.leave,
        expenses: requests.expenses,
      },
      200,
    );
  })
  .openapi(activityRoute, async (c) => {
    const { before, ...query } = c.req.valid("query");
    const { scope } = await resolveScope(c, query);
    const includeAudit = await hasWorkspacePermission(c, { audit: ["read"] });
    return c.json(
      await activityFeed({
        ...scope,
        before: before ? new Date(before) : undefined,
        includeAudit,
      }),
      200,
    );
  });

export default reports;
