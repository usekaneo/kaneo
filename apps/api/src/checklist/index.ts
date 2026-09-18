import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  responseTimestamp,
  z,
} from "../openapi";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  checklistItemTaskIds,
  createChecklist,
  deleteChecklist,
  listChecklists,
  renameChecklist,
  reorderChecklists,
  setChecklistItems,
} from "./controllers";

const tags = ["Checklists"];
const json = <T>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});
const idParam = z.object({ id: z.string() });
const title = z.string().trim().max(120);

const checklistSchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    title: z.string().nullable().openapi({
      description: 'Null shows as the default name, "Checklist".',
    }),
    position: z.number(),
    createdAt: responseTimestamp,
  })
  .openapi("TaskChecklist");

// The task id comes from the path or the JSON body, which the middleware
// reads before validation.

const listRoute = createRoute({
  method: "get",
  operationId: "listTaskChecklists",
  path: "/{taskId}",
  tags,
  summary: "List a task's checklists",
  description:
    "In order. Their items are the task's subtask relations (see /task-relation), each carrying `checklistId` and `position`.",
  middleware: [workspaceAccess.fromTaskId("taskId")] as const,
  request: { params: z.object({ taskId: z.string() }) },
  responses: {
    200: jsonResponse("Checklists", z.array(checklistSchema)),
    403: errorResponse("No access to the task's workspace"),
  },
});

const createRouteDef = createRoute({
  method: "post",
  operationId: "createTaskChecklist",
  path: "/",
  tags,
  summary: "Add a checklist",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    body: json(
      z.object({
        taskId: z.string(),
        title: title.optional().openapi({ example: "QA" }),
      }),
    ),
  },
  responses: {
    200: jsonResponse("Created", checklistSchema),
    403: errorResponse("Missing task:update"),
  },
});

const renameRoute = createRoute({
  method: "patch",
  operationId: "renameTaskChecklist",
  path: "/{id}",
  tags,
  summary: "Rename a checklist",
  description: "An empty title goes back to the default name.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: idParam,
    body: json(z.object({ taskId: z.string(), title })),
  },
  responses: {
    200: jsonResponse("Renamed", checklistSchema),
    403: errorResponse("Missing task:update"),
    404: errorResponse("Not a checklist of this task"),
  },
});

const deleteRouteDef = createRoute({
  method: "delete",
  operationId: "deleteTaskChecklist",
  path: "/{id}",
  tags,
  summary: "Delete a checklist",
  description:
    "Deletes the checklist and its items, which are tasks. Needs task:delete when it has any.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: idParam, body: json(z.object({ taskId: z.string() })) },
  responses: {
    200: jsonResponse(
      "Deleted",
      z.object({ id: z.string(), deletedItems: z.number() }),
    ),
    403: errorResponse("Missing task:update, or task:delete for its items"),
    404: errorResponse("Not a checklist of this task"),
  },
});

const reorderRoute = createRoute({
  method: "put",
  operationId: "reorderTaskChecklists",
  path: "/order",
  tags,
  summary: "Reorder checklists",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    body: json(
      z.object({
        taskId: z.string(),
        checklistIds: z.array(z.string()).max(100),
      }),
    ),
  },
  responses: {
    200: jsonResponse(
      "Checklists in their new order",
      z.array(checklistSchema),
    ),
    400: errorResponse("A checklist of another task was listed"),
  },
});

const itemsRoute = createRoute({
  method: "put",
  operationId: "setTaskChecklistItems",
  path: "/{id}/items",
  tags,
  summary: "Order a checklist's items",
  description:
    "Send the checklist's full list of subtask relation ids in order. Ids from another checklist of the same task are moved into this one.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: idParam,
    body: json(
      z.object({
        taskId: z.string(),
        relationIds: z.array(z.string()).max(500),
      }),
    ),
  },
  responses: {
    200: jsonResponse("Saved", z.object({ id: z.string() })),
    400: errorResponse("An item isn't a subtask of this task"),
    404: errorResponse("Not a checklist of this task"),
  },
});

const checklist = apiRouter()
  .openapi(listRoute, async (c) =>
    c.json(await listChecklists(c.req.valid("param").taskId), 200),
  )
  // Registered before /{id} routes so "order" isn't read as an id.
  .openapi(reorderRoute, async (c) => {
    const { taskId, checklistIds } = c.req.valid("json");
    return c.json(
      await reorderChecklists(taskId, c.get("userId"), checklistIds),
      200,
    );
  })
  .openapi(createRouteDef, async (c) => {
    const { taskId, title: name } = c.req.valid("json");
    return c.json(await createChecklist(taskId, c.get("userId"), name), 200);
  })
  .openapi(renameRoute, async (c) => {
    const { taskId, title: name } = c.req.valid("json");
    return c.json(
      await renameChecklist(
        taskId,
        c.req.valid("param").id,
        c.get("userId"),
        name,
      ),
      200,
    );
  })
  .openapi(itemsRoute, async (c) => {
    const { taskId, relationIds } = c.req.valid("json");
    return c.json(
      await setChecklistItems(
        taskId,
        c.req.valid("param").id,
        c.get("userId"),
        relationIds,
      ),
      200,
    );
  })
  .openapi(deleteRouteDef, async (c) => {
    const { taskId } = c.req.valid("json");
    const { id } = c.req.valid("param");
    const items = await checklistItemTaskIds(taskId, id);
    if (
      items.length > 0 &&
      !(await hasWorkspacePermission(c, { task: ["delete"] }))
    ) {
      throw new HTTPException(403, {
        message:
          "Deleting this checklist deletes its items, which needs task:delete",
      });
    }
    return c.json(await deleteChecklist(taskId, id, c.get("userId")), 200);
  });

export default checklist;
