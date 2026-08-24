import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { integrationTable } from "../database/schema";
import { scopeToProjectFromBody } from "../integrations/middleware";
import { projectIdBody, projectIdParam } from "../integrations/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { type GiteaConfig, validateGiteaConfig } from "../plugins/gitea/config";
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
import verifyGiteaAccess from "./controllers/verify-gitea-access";
import {
  giteaDeleteResultSchema,
  giteaImportResultSchema,
  giteaIntegrationSchema,
  giteaRepositoryListSchema,
  giteaVerificationResultSchema,
  integrationNotFoundSchema,
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
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const verifyRoute = createRoute({
  method: "post",
  operationId: "verifyGiteaAccess",
  path: "/verify",
  tags: ["Gitea"],
  summary: "Verify Gitea access",
  description:
    "Check that the base URL is a Gitea instance and that the token can reach the repository with the permissions Kaneo needs. Always 200 -- problems are reported in the body.",
  middleware: manageAccess,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: verifyGiteaBody } },
    },
  },
  responses: {
    200: jsonResponse("Verification result", giteaVerificationResultSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
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
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
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
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
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
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: jsonResponse("Integration not found", integrationNotFoundSchema),
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
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: errorResponse("Gitea integration not found"),
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
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: projectIdBody } },
    },
  },
  responses: {
    200: jsonResponse("Import summary", giteaImportResultSchema),
    400: errorResponse("projectId is required"),
    403: errorResponse(
      "No workspace access, or missing task:create permission",
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
    const result = await verifyGiteaAccess(body);
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
    });
    const integration = await getGiteaIntegration(projectId, true);
    if (!integration) {
      throw new HTTPException(500, { message: "Failed to load integration" });
    }
    return c.json(integration, 200);
  })
  .openapi(updateIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const row = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "gitea"),
      ),
    });

    if (!row) {
      return c.json({ error: "Integration not found" }, 404);
    }

    let config: GiteaConfig;
    try {
      config = JSON.parse(row.config) as GiteaConfig;
    } catch {
      throw new HTTPException(500, { message: "Invalid integration config" });
    }

    if (body.commentTaskLinkOnGiteaIssue !== undefined) {
      config = {
        ...config,
        commentTaskLinkOnGiteaIssue: body.commentTaskLinkOnGiteaIssue,
      };
    }

    const validation = await validateGiteaConfig(config);
    if (!validation.valid) {
      throw new HTTPException(400, {
        message: validation.errors?.join(", ") ?? "Invalid config",
      });
    }

    await db
      .update(integrationTable)
      .set({
        config: JSON.stringify(config),
        isActive:
          body.isActive !== undefined ? body.isActive : (row.isActive ?? true),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(integrationTable.projectId, projectId),
          eq(integrationTable.type, "gitea"),
        ),
      );

    const updated = await getGiteaIntegration(projectId, true);
    if (!updated) {
      throw new HTTPException(500, { message: "Failed to load integration" });
    }
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
    return c.json({ error: "Missing integration id" }, 400);
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
    return c.json({ error: result.error }, 400);
  }

  return c.json({ status: "success" });
}

export default giteaIntegration;
