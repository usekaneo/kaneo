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
import { createdExternalLinkSchema, externalLinkListSchema } from "./response";
import { createExternalLinkBody, taskIdParam } from "./schema";

const createExternalLinkRoute = createRoute({
  method: "post",
  operationId: "createExternalLink",
  path: "/task/{taskId}",
  tags: ["External Links"],
  summary: "Create an external link",
  description: "Add a resource link to a task",
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
    403: errorResponse("No permission to update the task"),
  },
});

const getExternalLinksByTaskRoute = createRoute({
  method: "get",
  operationId: "getExternalLinksByTask",
  path: "/task/{taskId}",
  tags: ["External Links"],
  summary: "Get task external links",
  description:
    "Get all links from a task to resources in connected integrations, such as GitHub or Gitea issues.",
  middleware: [workspaceAccess.fromTaskId("taskId")] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse("External links for the task", externalLinkListSchema),
    400: errorResponse(
      "Unknown task, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the task's workspace"),
  },
});

const externalLink = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(createExternalLinkRoute, async (c) => {
    const { taskId } = c.req.valid("param");
    const { url, title } = c.req.valid("json");

    const link = await createExternalLink({
      taskId,
      url,
      title,
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
