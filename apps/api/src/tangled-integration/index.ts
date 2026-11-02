import { projectIdParam } from "../integrations/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createTangledIntegration from "./controllers/create-tangled-integration";
import deleteTangledIntegration from "./controllers/delete-tangled-integration";
import { getTangledOutcome } from "./controllers/get-tangled-outcome";
import { getTangledIntegration } from "./controllers/project-connection";
import updateTangledIntegration from "./controllers/update-tangled-integration";
import {
  tangledDeleteResultSchema,
  tangledProjectConnectionSchema,
  tangledOutcomeSchema,
} from "./response";
import {
  tangledProjectConnectionBody,
  updateTangledProjectConnectionBody,
} from "./schema";

const manage = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];
const read = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ project: ["read"] }),
];

const getRoute = createRoute({
  method: "get",
  path: "/project/{projectId}",
  operationId: "getTangledProjectIntegration",
  tags: ["Tangled"],
  summary: "Get Tangled project connection",
  middleware: read,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Tangled connection, or null when disconnected",
      tangledProjectConnectionSchema.nullable(),
    ),
    403: errorResponse("Project access denied"),
    404: errorResponse("Project not found"),
  },
});
const createRouteDefinition = createRoute({
  method: "post",
  path: "/project/{projectId}",
  operationId: "createTangledProjectIntegration",
  tags: ["Tangled"],
  summary: "Connect a Tangled repository",
  middleware: manage,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: tangledProjectConnectionBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "Stored Tangled connection",
      tangledProjectConnectionSchema,
    ),
    400: errorResponse("Invalid Tangled connection settings"),
    403: errorResponse("Workspace manage_settings permission required"),
    404: errorResponse("Project not found"),
    409: errorResponse("Tangled connection already exists"),
    502: errorResponse("Tangled repository could not be verified"),
  },
});
const updateRoute = createRoute({
  method: "patch",
  path: "/project/{projectId}",
  operationId: "updateTangledProjectIntegration",
  tags: ["Tangled"],
  summary: "Update Tangled project connection",
  middleware: manage,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: {
        "application/json": { schema: updateTangledProjectConnectionBody },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Updated Tangled connection",
      tangledProjectConnectionSchema,
    ),
    400: errorResponse("Invalid resulting Tangled connection settings"),
    403: errorResponse("Workspace manage_settings permission required"),
    404: errorResponse("Project or Tangled connection not found"),
    409: errorResponse("Connection changed; refresh before updating"),
    502: errorResponse("Tangled repository could not be verified"),
  },
});
const deleteRoute = createRoute({
  method: "delete",
  path: "/project/{projectId}",
  operationId: "deleteTangledProjectIntegration",
  tags: ["Tangled"],
  summary: "Disconnect Tangled project",
  middleware: manage,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("Disconnected Tangled", tangledDeleteResultSchema),
    403: errorResponse("Workspace manage_settings permission required"),
    404: errorResponse("Project or Tangled connection not found"),
  },
});

const outcomeRoute = createRoute({
  method: "get",
  path: "/project/{projectId}/outcome",
  operationId: "getTangledOutcome",
  tags: ["Tangled"],
  summary: "Get the latest sanitized Tangled processing outcome",
  middleware: manage,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Latest outcome, or null before a delivery",
      tangledOutcomeSchema.nullable(),
    ),
    403: errorResponse("Workspace manage_settings permission required"),
    404: errorResponse("Project or Tangled connection not found"),
  },
});

const tangledIntegration = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(outcomeRoute, async (c) =>
    c.json(await getTangledOutcome(c.req.valid("param").projectId), 200),
  )
  .openapi(getRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(await getTangledIntegration(projectId), 200);
  })
  .openapi(createRouteDefinition, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(
      await createTangledIntegration({ projectId, body: c.req.valid("json") }),
      200,
    );
  })
  .openapi(updateRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(
      await updateTangledIntegration({ projectId, body: c.req.valid("json") }),
      200,
    );
  })
  .openapi(deleteRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(await deleteTangledIntegration(projectId), 200);
  });

export default tangledIntegration;
