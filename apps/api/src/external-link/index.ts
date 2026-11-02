import { eq } from "drizzle-orm";
import db from "../database";
import { externalLinkTable } from "../database/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createExternalLink from "./controllers/create-external-link";
import deleteExternalLink from "./controllers/delete-external-link";
import updateExternalLink from "./controllers/update-external-link";
import {
  createdExternalLinkSchema,
  deletedExternalLinkSchema,
  externalLinkListSchema,
} from "./response";
import {
  createExternalLinkBody,
  deleteExternalLinkParam,
  taskIdParam,
  updateExternalLinkBody,
} from "./schema";

const createExternalLinkRoute = createRoute({
  method: "post",
  operationId: "createExternalLink",
  path: "/task/{taskId}",
  tags: ["External Links"],
  summary: "Create an external link",
  description:
    'Add a resource link to a task. Pass `resourceType: "pull_request"` with `metadata` to show the link as a pull request with its status.',
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: taskIdParam,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: createExternalLinkBody,
        },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "External link created successfully",
      createdExternalLinkSchema,
    ),
    400: errorResponse("Invalid external link data"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("No permission to update the task"),
    404: errorResponse("Task not found"),
  },
});

const updateExternalLinkRoute = createRoute({
  method: "patch",
  operationId: "updateExternalLink",
  path: "/task/{taskId}/{id}",
  tags: ["External Links"],
  summary: "Update a manual link",
  description:
    "Change the title of a manually added link, or the status of a manually added pull request link. Integration-managed links cannot be changed through this endpoint.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    params: deleteExternalLinkParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateExternalLinkBody } },
    },
  },
  responses: {
    200: jsonResponse("Link updated", createdExternalLinkSchema),
    400: errorResponse("Invalid link data"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("No permission to update the task"),
    404: errorResponse("Task or manual resource link not found"),
  },
});

const deleteExternalLinkRoute = createRoute({
  method: "delete",
  operationId: "deleteExternalLink",
  path: "/task/{taskId}/{id}",
  tags: ["External Links"],
  summary: "Remove a manual resource link",
  description:
    "Remove a manually added link from a task. Integration-managed links cannot be removed through this endpoint.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: { params: deleteExternalLinkParam },
  responses: {
    200: jsonResponse("Resource link removed", deletedExternalLinkSchema),
    400: errorResponse("Invalid link data"),
    401: errorResponse("Unauthorized"),
    403: errorResponse("No permission to update the task"),
    404: errorResponse("Task or manual resource link not found"),
  },
});

const getExternalLinksByTaskRoute = createRoute({
  method: "get",
  operationId: "getExternalLinksByTask",
  path: "/task/{taskId}",
  tags: ["External Links"],
  summary: "Get task external links",
  description:
    "Get manually added resource links and links from connected integrations, such as GitHub or Gitea issues.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["read"] }),
  ] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("External links for the task", externalLinkListSchema),
    403: errorResponse("No access to the project, or missing read permission"),
    404: errorResponse("Task not found"),
  },
});

const externalLink = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(createExternalLinkRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const { url, title, resourceType, metadata } = c.req.valid("json");

    const link = await createExternalLink({
      taskId,
      url,
      title,
      resourceType,
      metadata,
      userId: c.get("userId"),
    });

    return c.json(
      {
        ...link,
        metadata: link.metadata ? JSON.parse(link.metadata) : null,
      },
      200,
    );
  })
  .openapi(updateExternalLinkRoute, async (c) => {
    const { taskId, id } = c.req.valid("param");
    const { title, metadata } = c.req.valid("json");
    const link = await updateExternalLink({
      taskId,
      id,
      title,
      metadata,
      userId: c.get("userId"),
    });
    return c.json(
      { ...link, metadata: link.metadata ? JSON.parse(link.metadata) : null },
      200,
    );
  })
  .openapi(deleteExternalLinkRoute, async (c) => {
    const { taskId, id } = c.req.valid("param");
    return c.json(
      await deleteExternalLink({ taskId, id, userId: c.get("userId") }),
      200,
    );
  })
  .openapi(getExternalLinksByTaskRoute, async (c) => {
    const { taskId } = c.req.valid("param");

    const links = await db.query.externalLinkTable.findMany({
      where: eq(externalLinkTable.taskId, taskId),
      with: {
        // Never widen this: integration.config holds plaintext provider
        // secrets and this route is reachable by any workspace member.
        integration: { columns: { id: true, type: true } },
      },
    });

    return c.json(
      links.map((link) => ({
        ...link,
        metadata: link.metadata ? JSON.parse(link.metadata) : null,
      })),
      200,
    );
  });

export default externalLink;
