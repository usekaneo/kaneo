import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { assertSelfOrPermission } from "../utils/assert-self-or-permission";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  clockIn,
  clockOut,
  createSession,
  deleteSession,
  getAttendanceDays,
  getStatus,
  getTeamDay,
  updateSession,
} from "./controllers";
import {
  attendanceDaysSchema,
  attendanceSessionSchema,
  attendanceStatusSchema,
  teamAttendanceSchema,
} from "./response";
import {
  clockBody,
  createSessionBody,
  daysQuery,
  sessionParam,
  teamQuery,
  updateSessionBody,
  workspaceQuery,
} from "./schema";

const tags = ["Attendance"];

const statusRoute = createRoute({
  method: "get",
  operationId: "getAttendanceStatus",
  path: "/status",
  tags,
  summary: "My attendance today",
  description: "Whether you are clocked in, since when, and today's totals.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("Today's attendance", attendanceStatusSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const clockInRoute = createRoute({
  method: "post",
  operationId: "clockIn",
  path: "/clock-in",
  tags,
  summary: "Clock in",
  description: "Start an attendance session now.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: clockBody } },
    },
  },
  responses: {
    200: jsonResponse("Attendance after clocking in", attendanceStatusSchema),
    409: errorResponse("Already clocked in"),
  },
});

const clockOutRoute = createRoute({
  method: "post",
  operationId: "clockOut",
  path: "/clock-out",
  tags,
  summary: "Clock out",
  description: "End the open attendance session now.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: clockBody } },
    },
  },
  responses: {
    200: jsonResponse("Attendance after clocking out", attendanceStatusSchema),
    409: errorResponse("Not clocked in"),
  },
});

const daysRoute = createRoute({
  method: "get",
  operationId: "getAttendanceDays",
  path: "/days",
  tags,
  summary: "Attendance by day",
  description:
    "Worked, overtime, active and idle time per day for one person, in the workspace timezone.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: daysQuery },
  responses: {
    200: jsonResponse("Days in the range", attendanceDaysSchema),
    400: errorResponse("Invalid range"),
    403: errorResponse("Not you, and missing people:read_all"),
  },
});

const teamRoute = createRoute({
  method: "get",
  operationId: "getTeamAttendance",
  path: "/team",
  tags,
  summary: "Team attendance for a day",
  description: "Everyone's attendance for one day.",
  middleware: [
    workspaceAccess.fromQuery(),
    requireWorkspacePermission({ people: ["read_all"] }),
  ] as const,
  request: { query: teamQuery },
  responses: {
    200: jsonResponse("One row per person", teamAttendanceSchema),
    403: errorResponse("Missing people:read_all permission"),
  },
});

const manage = requireWorkspacePermission({ people: ["manage"] });

const createSessionRoute = createRoute({
  method: "post",
  operationId: "createAttendanceSession",
  path: "/sessions",
  tags,
  summary: "Add an attendance session",
  description: "Record time someone forgot to clock. Audit logged.",
  middleware: [workspaceAccess.fromBody(), manage] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createSessionBody } },
    },
  },
  responses: {
    200: jsonResponse("The new session", attendanceSessionSchema),
    403: errorResponse("Missing people:manage permission"),
    409: errorResponse("The person already has an open session"),
  },
});

const updateSessionRoute = createRoute({
  method: "put",
  operationId: "updateAttendanceSession",
  path: "/sessions/{id}",
  tags,
  summary: "Correct an attendance session",
  description: "Change clock-in/out times. Audit logged.",
  middleware: [workspaceAccess.fromBody(), manage] as const,
  request: {
    params: sessionParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateSessionBody } },
    },
  },
  responses: {
    200: jsonResponse("The corrected session", attendanceSessionSchema),
    403: errorResponse("Missing people:manage permission"),
    404: errorResponse("Session not found"),
  },
});

const deleteSessionRoute = createRoute({
  method: "delete",
  operationId: "deleteAttendanceSession",
  path: "/sessions/{id}",
  tags,
  summary: "Delete an attendance session",
  description: "Remove a session recorded by mistake. Audit logged.",
  middleware: [workspaceAccess.fromQuery(), manage] as const,
  request: { params: sessionParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("The deleted session", attendanceSessionSchema),
    403: errorResponse("Missing people:manage permission"),
    404: errorResponse("Session not found"),
  },
});

const attendance = apiRouter()
  .openapi(statusRoute, async (c) =>
    c.json(
      await getStatus(c.req.valid("query").workspaceId, c.get("userId")),
      200,
    ),
  )
  .openapi(clockInRoute, async (c) => {
    const { workspaceId, note } = c.req.valid("json");
    return c.json(await clockIn(workspaceId, c.get("userId"), note), 200);
  })
  .openapi(clockOutRoute, async (c) => {
    const { workspaceId } = c.req.valid("json");
    return c.json(await clockOut(workspaceId, c.get("userId")), 200);
  })
  .openapi(daysRoute, async (c) => {
    const { workspaceId, userId, from, to } = c.req.valid("query");
    const target = userId ?? c.get("userId");
    await assertSelfOrPermission(c, target, { people: ["read_all"] });
    return c.json(await getAttendanceDays(workspaceId, target, from, to), 200);
  })
  .openapi(teamRoute, async (c) => {
    const { workspaceId, day } = c.req.valid("query");
    return c.json(await getTeamDay(workspaceId, day), 200);
  })
  .openapi(createSessionRoute, async (c) => {
    const {
      workspaceId,
      userId,
      clockIn: start,
      clockOut: end,
      note,
    } = c.req.valid("json");
    return c.json(
      await createSession(workspaceId, c.get("userId"), {
        userId,
        clockIn: new Date(start),
        clockOut: end ? new Date(end) : undefined,
        note,
      }),
      200,
    );
  })
  .openapi(updateSessionRoute, async (c) => {
    const { id } = c.req.valid("param");
    const {
      workspaceId,
      clockIn: start,
      clockOut: end,
      note,
    } = c.req.valid("json");
    return c.json(
      await updateSession(workspaceId, c.get("userId"), id, {
        clockIn: new Date(start),
        clockOut: end === undefined ? undefined : end ? new Date(end) : null,
        note,
      }),
      200,
    );
  })
  .openapi(deleteSessionRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(
      await deleteSession(
        c.req.valid("query").workspaceId,
        c.get("userId"),
        id,
      ),
      200,
    );
  });

export default attendance;
