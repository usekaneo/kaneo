import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { assertCanManageTimeEntry, canSeeEveryonesTime } from "./access";
import createTimeEntry from "./controllers/create-time-entry";
import deleteTimeEntry from "./controllers/delete-time-entry";
import getRunningTimeEntry from "./controllers/get-running-time-entry";
import getTimeEntriesByTaskId from "./controllers/get-time-entries";
import getTimeEntry from "./controllers/get-time-entry";
import listTimeEntries from "./controllers/list-time-entries";
import stopTimeEntry from "./controllers/stop-time-entry";
import updateTimeEntry from "./controllers/update-time-entry";
import {
  runningTimeEntrySchema,
  timeEntryDetailListSchema,
  timeEntryListSchema,
  timeEntrySchema,
} from "./response";
import {
  createTimeEntryBody,
  listTimeEntriesQuery,
  runningTimeEntryQuery,
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

const listTimeEntriesRoute = createRoute({
  method: "get",
  operationId: "listTimeEntries",
  path: "/",
  tags: ["Time Entries"],
  summary: "List time entries",
  description:
    "List time entries in a workspace that started within a date range, with their task and project. Without timeEntry:read_all only your own entries are returned.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: listTimeEntriesQuery },
  responses: {
    200: jsonResponse(
      "Time entries in the range, oldest first",
      timeEntryDetailListSchema,
    ),
    400: errorResponse("Invalid range, or missing workspaceId"),
    403: errorResponse(
      "No workspace access, or asked for someone else's entries without timeEntry:read_all",
    ),
  },
});

const getRunningTimeEntryRoute = createRoute({
  method: "get",
  operationId: "getRunningTimeEntry",
  path: "/running",
  tags: ["Time Entries"],
  summary: "Get my running time entry",
  description:
    "The caller's running timer in a workspace, or null when nothing is being tracked.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: runningTimeEntryQuery },
  responses: {
    200: jsonResponse("The running entry, or null", runningTimeEntrySchema),
    400: errorResponse("Missing workspaceId"),
    403: errorResponse("No access to the workspace"),
  },
});

const stopTimeEntryRoute = createRoute({
  method: "post",
  operationId: "stopTimeEntry",
  path: "/{id}/stop",
  tags: ["Time Entries"],
  summary: "Stop time entry",
  description:
    "Stop a running entry now. Stopping an entry that already ended returns it unchanged.",
  middleware: [
    workspaceAccess.fromTimeEntry(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: timeEntryParam },
  responses: {
    200: jsonResponse("The stopped time entry", timeEntrySchema),
    403: errorResponse(
      "Missing task:update permission, or not your entry without timeEntry:manage_all",
    ),
    404: errorResponse("Time entry not found"),
  },
});

const deleteTimeEntryRoute = createRoute({
  method: "delete",
  operationId: "deleteTimeEntry",
  path: "/{id}",
  tags: ["Time Entries"],
  summary: "Delete time entry",
  description: "Delete a time entry.",
  middleware: [
    workspaceAccess.fromTimeEntry(),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: timeEntryParam },
  responses: {
    200: jsonResponse("The deleted time entry", timeEntrySchema),
    403: errorResponse(
      "Missing task:update permission, or not your entry without timeEntry:manage_all",
    ),
    404: errorResponse("Time entry not found"),
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
    "Log time against a task. Omit endTime to start a running entry that can be closed later with an update.",
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
    "Replace a time entry's start, end, and description. Setting endTime closes a running entry and fills in its duration. Other people's entries need timeEntry:manage_all.",
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
      "No workspace access, missing task:update permission, or not your entry without timeEntry:manage_all",
    ),
  },
});

const timeEntry = apiRouter()
  // Static paths are registered before /{id} so "running" is never read as an id.
  .openapi(listTimeEntriesRoute, async (c) => {
    const { workspaceId, from, to, userId, projectId } = c.req.valid("query");
    const self = c.get("userId");
    const seeEveryone = await canSeeEveryonesTime(c);
    if (!seeEveryone && userId && userId !== self) {
      throw new HTTPException(403, {
        message: "You can only see your own time entries",
      });
    }
    return c.json(
      await listTimeEntries({
        workspaceId,
        from: new Date(from),
        to: new Date(to),
        userId: seeEveryone ? userId : self,
        projectId,
      }),
      200,
    );
  })
  .openapi(getRunningTimeEntryRoute, async (c) => {
    const { workspaceId } = c.req.valid("query");
    return c.json(await getRunningTimeEntry(c.get("userId"), workspaceId), 200);
  })
  .openapi(stopTimeEntryRoute, async (c) => {
    const { id } = c.req.valid("param");
    await assertCanManageTimeEntry(c, id);
    return c.json(await stopTimeEntry(id), 200);
  })
  .openapi(deleteTimeEntryRoute, async (c) => {
    const { id } = c.req.valid("param");
    await assertCanManageTimeEntry(c, id);
    return c.json(await deleteTimeEntry(id), 200);
  })
  .openapi(getTaskTimeEntriesRoute, async (c) =>
    c.json(await getTimeEntriesByTaskId(c.req.valid("param").taskId), 200),
  )
  .openapi(getTimeEntryRoute, async (c) =>
    c.json(await getTimeEntry(c.req.valid("param").id), 200),
  )
  .openapi(createTimeEntryRoute, async (c) => {
    const { taskId, startTime, endTime, description } = c.req.valid("json");
    return c.json(
      await createTimeEntry({
        taskId,
        userId: c.get("userId"),
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        description,
      }),
      200,
    );
  })
  .openapi(updateTimeEntryRoute, async (c) => {
    const { id } = c.req.valid("param");
    await assertCanManageTimeEntry(c, id);
    const { startTime, endTime, description } = c.req.valid("json");
    return c.json(
      await updateTimeEntry({
        timeEntryId: id,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        description,
      }),
      200,
    );
  });

export default timeEntry;
