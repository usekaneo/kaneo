import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createColumn from "./controllers/create-column";
import deleteColumn from "./controllers/delete-column";
import getColumns from "./controllers/get-columns";
import reorderColumns from "./controllers/reorder-columns";
import updateColumn from "./controllers/update-column";
import { columnListSchema, columnSchema } from "./response";
import {
  columnParam,
  createColumnBody,
  projectIdParam,
  reorderColumnsBody,
  updateColumnBody,
} from "./schema";

const getColumnsRoute = createRoute({
  method: "get",
  operationId: "getColumns",
  path: "/{projectId}",
  tags: ["Columns"],
  summary: "Get columns",
  description: "Get a project's board columns, ordered by position.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("List of columns ordered by position", columnListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createColumnRoute = createRoute({
  method: "post",
  operationId: "createColumn",
  path: "/{projectId}",
  tags: ["Columns"],
  summary: "Create column",
  description:
    "Add a column to the end of a project's board. The slug is derived from the name.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createColumnBody } },
    },
  },
  responses: {
    200: jsonResponse("The created column", columnSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    409: errorResponse("The slug is reserved, or already used in this project"),
  },
});

const reorderColumnsRoute = createRoute({
  method: "put",
  operationId: "reorderColumns",
  path: "/reorder/{projectId}",
  tags: ["Columns"],
  summary: "Reorder columns",
  description:
    "Set new positions for a project's columns and return the whole board in its new order.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: reorderColumnsBody } },
    },
  },
  responses: {
    200: jsonResponse("The reordered columns", columnListSchema),
    400: errorResponse("A column does not belong to this project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const updateColumnRoute = createRoute({
  method: "put",
  operationId: "updateColumn",
  path: "/{id}",
  tags: ["Columns"],
  summary: "Update column",
  description:
    "Update a column. Omitted fields are left unchanged; icon and color accept null to clear them.",
  middleware: [
    workspaceAccess.fromColumn("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: columnParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateColumnBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated column", columnSchema),
    400: errorResponse("Invalid body, or unknown column"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const deleteColumnRoute = createRoute({
  method: "delete",
  operationId: "deleteColumn",
  path: "/{id}",
  tags: ["Columns"],
  summary: "Delete column",
  description:
    "Delete an empty column. A column holding tasks is refused until they are moved or deleted.",
  middleware: [
    workspaceAccess.fromColumn("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: columnParam },
  responses: {
    200: jsonResponse("The deleted column", columnSchema),
    400: errorResponse(
      "Unknown column, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
    409: errorResponse("The column still contains tasks"),
  },
});

const column = apiRouter()
  .openapi(getColumnsRoute, async (c) =>
    c.json(await getColumns(c.req.valid("param").projectId), 200),
  )
  .openapi(createColumnRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const { name, icon, color, isFinal } = c.req.valid("json");
    return c.json(
      await createColumn({ projectId, name, icon, color, isFinal }),
      200,
    );
  })
  .openapi(reorderColumnsRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const { columns } = c.req.valid("json");
    return c.json(await reorderColumns(projectId, columns), 200);
  })
  .openapi(updateColumnRoute, async (c) =>
    c.json(
      await updateColumn(c.req.valid("param").id, c.req.valid("json")),
      200,
    ),
  )
  .openapi(deleteColumnRoute, async (c) =>
    c.json(await deleteColumn(c.req.valid("param").id), 200),
  );

export default column;
