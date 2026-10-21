import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { boundedRequestBody } from "../utils/bounded-request-body";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createPersonalView,
  deletePersonalView,
  listPersonalViews,
  updatePersonalView,
} from "./controllers";
import {
  savedViewBody,
  savedViewParam,
  savedViewProjectParam,
  savedViewSchema,
} from "./schema";

const middleware = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ project: ["read"], task: ["read"] }),
] as const;
const errors = {
  403: errorResponse("No access to project"),
  404: errorResponse("Project or personal view not found"),
};
const body = {
  required: true,
  content: { "application/json": { schema: savedViewBody } },
} as const;
const list = createRoute({
  method: "get",
  path: "/projects/{projectId}",
  operationId: "listPersonalProjectViews",
  tags: ["Personal Views"],
  summary: "List my project views",
  description:
    "Private named board/list presets owned by the caller. Project access is checked on every request.",
  middleware: [...middleware] as const,
  request: { params: savedViewProjectParam },
  responses: {
    200: jsonResponse("Personal views", z.array(savedViewSchema)),
    ...errors,
  },
});
const create = createRoute({
  method: "post",
  path: "/projects/{projectId}",
  operationId: "createPersonalProjectView",
  tags: ["Personal Views"],
  summary: "Save a personal project view",
  description:
    "Save filters, search, sort and board/list layout for the caller only. At most 50 views per user and project.",
  middleware: [boundedRequestBody(131072), ...middleware] as const,
  request: { params: savedViewProjectParam, body },
  responses: {
    201: jsonResponse("Saved view", savedViewSchema),
    400: errorResponse("Invalid view"),
    409: errorResponse("View limit reached"),
    413: errorResponse("View is too large"),
    ...errors,
  },
});
const update = createRoute({
  method: "put",
  path: "/projects/{projectId}/{id}",
  operationId: "updatePersonalProjectView",
  tags: ["Personal Views"],
  summary: "Rename or replace my project view",
  description:
    "Only the caller's own view in this project can be updated. Other owners' IDs return 404.",
  middleware: [boundedRequestBody(131072), ...middleware] as const,
  request: { params: savedViewParam, body },
  responses: {
    200: jsonResponse("Updated view", savedViewSchema),
    400: errorResponse("Invalid view"),
    413: errorResponse("View is too large"),
    ...errors,
  },
});
const remove = createRoute({
  method: "delete",
  path: "/projects/{projectId}/{id}",
  operationId: "deletePersonalProjectView",
  tags: ["Personal Views"],
  summary: "Delete my project view",
  description:
    "Delete only the caller's own view. Other owners' IDs return 404.",
  middleware: [...middleware] as const,
  request: { params: savedViewParam },
  responses: {
    200: jsonResponse("Deleted", z.object({ success: z.literal(true) })),
    ...errors,
  },
});

export default apiRouter()
  .openapi(list, async (c) =>
    c.json(
      await listPersonalViews(c.req.valid("param").projectId, c.get("userId")),
      200,
    ),
  )
  .openapi(create, async (c) =>
    c.json(
      await createPersonalView(
        c.req.valid("param").projectId,
        c.get("userId"),
        c.req.valid("json"),
      ),
      201,
    ),
  )
  .openapi(update, async (c) => {
    const { projectId, id } = c.req.valid("param");
    return c.json(
      await updatePersonalView(
        projectId,
        c.get("userId"),
        id,
        c.req.valid("json"),
      ),
      200,
    );
  })
  .openapi(remove, async (c) => {
    const { projectId, id } = c.req.valid("param");
    return c.json(
      await deletePersonalView(projectId, c.get("userId"), id),
      200,
    );
  });
