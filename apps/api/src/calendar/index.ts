import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createHoliday from "./controllers/create-holiday";
import deleteHoliday from "./controllers/delete-holiday";
import getCalendar from "./controllers/get-calendar";
import updateWorkingDays from "./controllers/update-working-days";
import { holidaySchema, workspaceCalendarSchema } from "./response";
import {
  createHolidayBody,
  holidayParam,
  updateWorkingDaysBody,
  workspaceIdParam,
} from "./schema";

// Same permission editing workspace name/description already requires (see
// useWorkspacePermission's `manageWorkspace` capability on the web) — kept as
// one constant so the two mutating routes below can't drift apart.
const MANAGE_CALENDAR_PERMISSION = {
  workspace: ["update", "manage_settings"],
};

const getCalendarRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceCalendar",
  path: "/{workspaceId}",
  tags: ["Calendar"],
  summary: "Get workspace calendar",
  description:
    "Get the workspace's working-days bitmask and holidays, sorted by date.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse(
      "The workspace's working calendar",
      workspaceCalendarSchema,
    ),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
    404: errorResponse("Workspace not found"),
  },
});

const updateWorkingDaysRoute = createRoute({
  method: "put",
  operationId: "updateWorkspaceWorkingDays",
  path: "/{workspaceId}",
  tags: ["Calendar"],
  summary: "Update working days",
  description:
    "Set the workspace's working-weekday bitmask (bit i, i = 0..6, 0 = Sunday).",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission(MANAGE_CALENDAR_PERMISSION),
  ] as const,
  request: {
    params: workspaceIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateWorkingDaysBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The updated working-days bitmask",
      workspaceCalendarSchema.pick({ workingDays: true }),
    ),
    400: errorResponse("Invalid body, or workspace ID could not be determined"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings permission",
    ),
    404: errorResponse("Workspace not found"),
  },
});

const createHolidayRoute = createRoute({
  method: "post",
  operationId: "createWorkspaceHoliday",
  path: "/{workspaceId}/holidays",
  tags: ["Calendar"],
  summary: "Add a holiday",
  description:
    "Add a non-working date to the workspace calendar. The date is normalized to UTC midnight.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission(MANAGE_CALENDAR_PERMISSION),
  ] as const,
  request: {
    params: workspaceIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createHolidayBody } },
    },
  },
  responses: {
    200: jsonResponse("The created holiday", holidaySchema),
    400: errorResponse("Invalid body, or workspace ID could not be determined"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings permission",
    ),
    409: errorResponse("A holiday already exists on this date"),
  },
});

const deleteHolidayRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkspaceHoliday",
  path: "/{workspaceId}/holidays/{holidayId}",
  tags: ["Calendar"],
  summary: "Remove a holiday",
  description: "Remove a holiday from the workspace calendar.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission(MANAGE_CALENDAR_PERMISSION),
  ] as const,
  request: { params: holidayParam },
  responses: {
    200: jsonResponse("The deleted holiday", holidaySchema),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings permission",
    ),
    404: errorResponse("Holiday not found"),
  },
});

const calendar = apiRouter()
  .openapi(getCalendarRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    return c.json(await getCalendar(workspaceId), 200);
  })
  .openapi(updateWorkingDaysRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { workingDays } = c.req.valid("json");
    return c.json(await updateWorkingDays(workspaceId, workingDays), 200);
  })
  .openapi(createHolidayRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { date, name } = c.req.valid("json");
    return c.json(await createHoliday(workspaceId, date, name), 200);
  })
  .openapi(deleteHolidayRoute, async (c) => {
    const { workspaceId, holidayId } = c.req.valid("param");
    return c.json(await deleteHoliday(workspaceId, holidayId), 200);
  });

export default calendar;
