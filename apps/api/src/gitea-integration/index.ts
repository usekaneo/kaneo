import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { publishEvent } from "../events";
import { scopeToProjectFromBody } from "../integrations/middleware";
import { projectIdBody, projectIdParam } from "../integrations/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { handleGiteaWebhookRequest } from "../plugins/gitea/webhook-handler";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createGiteaIntegration from "./controllers/create-gitea-integration";
import deleteGiteaIntegration from "./controllers/delete-gitea-integration";
import getGiteaIntegration from "./controllers/get-gitea-integration";
import { importGiteaIssues } from "./controllers/import-gitea-issues";
import listGiteaRepositories from "./controllers/list-gitea-repositories";
import { resolveVerificationContext } from "./controllers/resolve-verification-context";
import updateGiteaIntegration from "./controllers/update-gitea-integration";
import verifyGiteaAccess from "./controllers/verify-gitea-access";
import {
  giteaDeleteResultSchema,
  giteaImportResultSchema,
  giteaIntegrationSchema,
  giteaRepositoryListSchema,
  giteaVerificationResultSchema,
} from "./response";
import {
  createGiteaBody,
  listGiteaRepositoriesBody,
  updateGiteaBody,
  verifyGiteaBody,
} from "./schema";

const manageAccess = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const listRepositoriesRoute = createRoute({
  method: "post",
  operationId: "listGiteaRepositories",
  path: "/repositories",
  tags: ["Gitea"],
  summary: "List Gitea repositories",
  description:
    "List the repositories a Gitea token can reach, for picking one to link. Sent as a POST because the token travels in the body rather than the URL.",
  middleware: manageAccess,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: listGiteaRepositoriesBody } },
    },
  },
  responses: {
    200: jsonResponse("Accessible repositories", giteaRepositoryListSchema),
    400: errorResponse("Invalid body, or invalid Gitea credentials"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
  },
});

const verifyRoute = createRoute({
  method: "post",
  operationId: "verifyGiteaAccess",
  path: "/verify",
  tags: ["Gitea"],
  summary: "Verify Gitea access",
  description:
    "Check that the base URL is a Gitea instance and that the token can reach the repository with the permissions Kaneo needs. Repository permission failures are reported in the body; invalid credentials and upstream errors return an error status. Omit accessToken to use the saved token for the unchanged base URL.",
  middleware: manageAccess,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: verifyGiteaBody } },
    },
  },
  responses: {
    200: jsonResponse("Verification result", giteaVerificationResultSchema),
    401: errorResponse("Kaneo authentication required"),
    500: errorResponse("Gitea verification failed"),
    400: errorResponse("Invalid body, or invalid Gitea credentials"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
  },
});

const getIntegrationRoute = createRoute({
  method: "get",
  operationId: "getGiteaIntegration",
  path: "/project/{projectId}",
  tags: ["Gitea"],
  summary: "Get Gitea integration",
  description:
    "Get the Gitea integration for a project, or null when none is configured. The webhook secret is included only for callers with workspace:manage_settings.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Gitea integration details, or null",
      giteaIntegrationSchema.nullable(),
    ),
    403: errorResponse("No access to the project"),
    404: errorResponse("Project not found"),
  },
});

const createIntegrationRoute = createRoute({
  method: "post",
  operationId: "createGiteaIntegration",
  path: "/project/{projectId}",
  tags: ["Gitea"],
  summary: "Create Gitea integration",
  description:
    "Link a project to a Gitea repository, creating the webhook Gitea will post events to. Use the verify route first to confirm the token really reaches the repository.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createGiteaBody } },
    },
  },
  responses: {
    200: jsonResponse("The stored integration", giteaIntegrationSchema),
    400: errorResponse("Invalid body"),
    409: errorResponse("Integration changed or repository is already linked"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
  },
});

const updateIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateGiteaIntegration",
  path: "/project/{projectId}",
  tags: ["Gitea"],
  summary: "Update Gitea integration",
  description:
    "Update the Gitea integration. Omitted fields keep their current value.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateGiteaBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated integration", giteaIntegrationSchema),
    400: errorResponse("The resulting config failed validation"),
    409: errorResponse("Integration changed. Reload and try again."),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project or integration not found"),
  },
});

const deleteIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteGiteaIntegration",
  path: "/project/{projectId}",
  tags: ["Gitea"],
  summary: "Delete Gitea integration",
  description: "Unlink a project from its Gitea repository.",
  middleware: manageAccess,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("The integration was removed", giteaDeleteResultSchema),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project or Gitea integration not found"),
  },
});

const importIssuesRoute = createRoute({
  method: "post",
  operationId: "importGiteaIssues",
  path: "/import-issues",
  tags: ["Gitea"],
  summary: "Import Gitea issues",
  description:
    "Import the linked repository's issues as tasks. Issues that already have a task are refreshed rather than duplicated.",
  middleware: [
    scopeToProjectFromBody,
    requireWorkspacePermission({ task: ["create", "update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: projectIdBody } },
    },
  },
  responses: {
    200: jsonResponse("Import summary", giteaImportResultSchema),
    400: errorResponse(
      "Invalid request, inactive integration, or issue sync is off",
    ),
    403: errorResponse(
      "No access to the project, or missing task:create or task:update permission",
    ),
    404: errorResponse("Project not found"),
  },
});

const giteaIntegration = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listRepositoriesRoute, async (c) => {
    const { baseUrl, accessToken } = c.req.valid("json");
    const result = await listGiteaRepositories({ baseUrl, accessToken });
    return c.json(result, 200);
  })
  .openapi(verifyRoute, async (c) => {
    const body = c.req.valid("json");
    const { accessToken, issueSyncMode } =
      await resolveVerificationContext(body);
    const result = await verifyGiteaAccess({
      ...body,
      accessToken,
      issueSyncMode,
    });
    return c.json(result, 200);
  })
  .openapi(getIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const includeWebhookSecret = await hasWorkspacePermission(c, {
      workspace: ["manage_settings"],
    });
    const integration = await getGiteaIntegration(
      projectId,
      includeWebhookSecret,
    );
    if (!integration) {
      return c.json(null, 200);
    }
    return c.json(integration, 200);
  })
  .openapi(createIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    await createGiteaIntegration({
      projectId,
      baseUrl: body.baseUrl,
      accessToken: body.accessToken,
      repositoryOwner: body.repositoryOwner,
      repositoryName: body.repositoryName,
      issueSyncMode: body.issueSyncMode,
    });
    const integration = await getGiteaIntegration(projectId, true);
    if (!integration) {
      throw new HTTPException(500, { message: "Failed to load integration" });
    }
    if (integration)
      await publishEvent("integration.sync_rules_changed", {
        projectId,
        integrationId: integration.id,
        existingLinksOnly: true,
      });
    return c.json(integration, 200);
  })
  .openapi(updateIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    const updated = await updateGiteaIntegration(projectId, body);
    if (!updated) throw new HTTPException(404, { message: "Integration not found" });
    return c.json(updated, 200);
  })
  .openapi(deleteIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const result = await deleteGiteaIntegration(projectId);
    return c.json(result, 200);
  })
  .openapi(importIssuesRoute, async (c) => {
    const { projectId } = c.req.valid("json");
    const result = await importGiteaIssues(projectId);
    return c.json(result, 200);
  });

export async function handleGiteaWebhookRoute(c: Context) {
  const integrationId = c.req.param("integrationId");
  if (!integrationId) {
    throw new HTTPException(400, { message: "Missing integration id" });
  }

  const arrayBuffer = await c.req.arrayBuffer();
  const body = Buffer.from(arrayBuffer).toString("utf8");

  const signature =
    c.req.header("x-gitea-signature") || c.req.header("X-Gitea-Signature");

  const eventName =
    c.req.header("x-gitea-event") ||
    c.req.header("X-Gitea-Event") ||
    c.req.header("x-github-event");

  const result = await handleGiteaWebhookRequest(
    integrationId,
    body,
    signature,
    eventName,
  );

  if (!result.success) {
    throw new HTTPException(400, { message: result.error ?? "Invalid Gitea webhook" });
  }

  return c.json({ status: "success" });
}

export default giteaIntegration;
