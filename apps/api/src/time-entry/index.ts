import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createTimeEntry from "./controllers/create-time-entry";
import deleteTimeEntry from "./controllers/delete-time-entry";
import getRunningTimeEntry from "./controllers/get-running-time-entry";
import getTimeEntriesByTaskId from "./controllers/get-time-entries";
import getTimeEntry from "./controllers/get-time-entry";
import startTimeEntry from "./controllers/start-time-entry";
import stopTimeEntry from "./controllers/stop-time-entry";
import updateTimeEntry from "./controllers/update-time-entry";
import {
  runningTimeEntrySchema,
  startTimeEntryResultSchema,
  timeEntryListSchema,
  timeEntrySchema,
} from "./response";
import {
  createTimeEntryBody,
  startTimeEntryBody,
  taskIdParam,
  timeEntryParam,
  updateTimeEntryBody,
} from "./schema";

const getTaskTimeEntriesRoute = createRoute({
  method: "get",
  operationId: "getTaskTimeEntries",
  path: "/task/{taskId}",
  tags: ["Time Entries"],
  summary: "Get task time entries",
  description: "Get every time entry logged against a task.",
  middleware: [workspaceAccess.fromTaskId()] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("List of time entries for the task", timeEntryListSchema),
    400: errorResponse(
      "Unknown task, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the task's workspace"),
  },
});

const getTimeEntryRoute = createRoute({
  method: "get",
  operationId: "getTimeEntry",
  path: "/{id}",
  tags: ["Time Entries"],
  summary: "Get time entry",
  description: "Get a single time entry by ID.",
  middleware: [workspaceAccess.fromTimeEntry()] as const,
  request: { params: timeEntryParam },
  responses: {
    200: jsonResponse("Time entry details", timeEntrySchema),
    400: errorResponse(
      "Unknown entry, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the entry's workspace"),
  },
});

const createTimeEntryRoute = createRoute({
  method: "post",
  operationId: "createTimeEntry",
  path: "/",
  tags: ["Time Entries"],
  summary: "Create time entry",
  description:
    "Log completed time against a task. Both timestamps are required. Active tracking uses POST /start instead.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createTimeEntryBody } },
    },
  },
  responses: {
    200: jsonResponse("The created time entry", timeEntrySchema),
    400: errorResponse("Invalid timestamps, or unknown task"),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
  },
});

const updateTimeEntryRoute = createRoute({
  method: "put",
  operationId: "updateTimeEntry",
  path: "/{id}",
  tags: ["Time Entries"],
  summary: "Update time entry",
  description:
    "Edit an ended entry's start, end, duration, description, or billable flag. Passing duration takes precedence and derives the end time from the start. A running entry only accepts description and billable changes from the user tracking it.",
  middleware: [
    workspaceAccess.fromTimeEntry(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: timeEntryParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateTimeEntryBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated time entry", timeEntrySchema),
    400: errorResponse("Invalid timestamps, or unknown entry"),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
  },
});

const startTimeEntryRoute = createRoute({
  method: "post",
  operationId: "startTimeEntry",
  path: "/start",
  tags: ["Time Entries"],
  summary: "Start tracking time",
  description:
    "Start a running entry on a task with the server clock. A previously running entry is auto-stopped, or silently discarded when younger than 3 seconds. Retrying within 15 seconds on the same task returns the existing entry.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: startTimeEntryBody } },
    },
  },
  responses: {
    200: jsonResponse("The running time entry", startTimeEntryResultSchema),
    400: errorResponse("Invalid body, or unknown task"),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
    409: errorResponse("A timer is already running"),
  },
});

const stopTimeEntryRoute = createRoute({
  method: "post",
  operationId: "stopTimeEntry",
  path: "/task/{taskId}/stop",
  tags: ["Time Entries"],
  summary: "Stop tracking time",
  description:
    "Stop the caller's running entry on a task with the server clock. Returns 404 when nothing is running.",
  middleware: [
    workspaceAccess.fromTaskId(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("The ended time entry", timeEntrySchema),
    400: errorResponse("Unknown task"),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
    404: errorResponse("No running timer found for this task"),
  },
});

const getRunningTimeEntryRoute = createRoute({
  method: "get",
  operationId: "getRunningTimeEntry",
  path: "/running/me",
  tags: ["Time Entries"],
  summary: "Get running time entry",
  description:
    "Get the caller's running entry across workspaces, with its task, project, and workspace for navigation. Null when nothing is running.",
  responses: {
    200: jsonResponse(
      "The running time entry, or null",
      runningTimeEntrySchema.nullable(),
    ),
  },
});

const deleteTimeEntryRoute = createRoute({
  method: "delete",
  operationId: "deleteTimeEntry",
  path: "/{id}",
  tags: ["Time Entries"],
  summary: "Delete time entry",
  description:
    "Permanently delete an ended time entry and its activity row. A running entry must be stopped first.",
  middleware: [
    workspaceAccess.fromTimeEntry(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: timeEntryParam },
  responses: {
    200: jsonResponse("The deleted time entry", timeEntrySchema),
    400: errorResponse(
      "Unknown entry, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
    404: errorResponse("Time entry not found"),
    409: errorResponse("The entry is still running"),
  },
});

const timeEntry = apiRouter()
  .openapi(getTaskTimeEntriesRoute, async (c) =>
    c.json(await getTimeEntriesByTaskId(c.req.valid("param").taskId), 200),
  )
  .openapi(getRunningTimeEntryRoute, async (c) =>
    c.json(await getRunningTimeEntry(c.get("userId")), 200),
  )
  .openapi(getTimeEntryRoute, async (c) =>
    c.json(await getTimeEntry(c.req.valid("param").id), 200),
  )
  .openapi(createTimeEntryRoute, async (c) => {
    const { taskId, startTime, endTime, description, billable } =
      c.req.valid("json");
    return c.json(
      await createTimeEntry({
        taskId,
        userId: c.get("userId"),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        description,
        billable,
      }),
      200,
    );
  })
  .openapi(updateTimeEntryRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { startTime, endTime, duration, description, billable } =
      c.req.valid("json");
    return c.json(
      await updateTimeEntry({
        timeEntryId: id,
        userId: c.get("userId"),
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        duration,
        description,
        billable,
      }),
      200,
    );
  })
  .openapi(startTimeEntryRoute, async (c) => {
    const { taskId, description, billable } = c.req.valid("json");
    return c.json(
      await startTimeEntry({
        taskId,
        userId: c.get("userId"),
        description,
        billable,
      }),
      200,
    );
  })
  .openapi(stopTimeEntryRoute, async (c) =>
    c.json(
      await stopTimeEntry({
        taskId: c.req.valid("param").taskId,
        userId: c.get("userId"),
      }),
      200,
    ),
  )
  .openapi(deleteTimeEntryRoute, async (c) =>
    c.json(await deleteTimeEntry(c.req.valid("param").id), 200),
  );

export default timeEntry;
