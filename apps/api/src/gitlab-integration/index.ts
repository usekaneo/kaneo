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
import {
  type GitlabConfig,
  validateGitlabConfig,
} from "../plugins/gitlab/config";
import { handleGitlabWebhookRequest } from "../plugins/gitlab/webhook-handler";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createGitlabIntegration from "./controllers/create-gitlab-integration";
import deleteGitlabIntegration from "./controllers/delete-gitlab-integration";
import getGitlabIntegration from "./controllers/get-gitlab-integration";
import { importGitlabIssues } from "./controllers/import-gitlab-issues";
import listGitlabProjects from "./controllers/list-gitlab-projects";
import verifyGitlabAccess from "./controllers/verify-gitlab-access";
import {
  gitlabDeleteResultSchema,
  gitlabImportResultSchema,
  gitlabIntegrationSchema,
  gitlabProjectListSchema,
  gitlabVerificationResultSchema,
  integrationNotFoundSchema,
} from "./response";
import {
  createGitlabBody,
  listGitlabProjectsBody,
  updateGitlabBody,
  verifyGitlabBody,
} from "./schema";

const manageAccess = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const listProjectsRoute = createRoute({
  method: "post",
  operationId: "listGitlabProjects",
  path: "/projects",
  tags: ["GitLab"],
  summary: "List GitLab projects",
  description:
    "List the projects a GitLab token can reach, for picking one to link. Sent as a POST because the token travels in the body rather than the URL.",
  middleware: manageAccess,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: listGitlabProjectsBody } },
    },
  },
  responses: {
    200: jsonResponse("Accessible projects", gitlabProjectListSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const verifyRoute = createRoute({
  method: "post",
  operationId: "verifyGitlabAccess",
  path: "/verify",
  tags: ["GitLab"],
  summary: "Verify GitLab access",
  description:
    "Check that the base URL is a GitLab instance and that the token can reach the project with the permissions Kaneo needs. Always 200 -- problems are reported in the body.",
  middleware: manageAccess,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: verifyGitlabBody } },
    },
  },
  responses: {
    200: jsonResponse("Verification result", gitlabVerificationResultSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const getIntegrationRoute = createRoute({
  method: "get",
  operationId: "getGitlabIntegration",
  path: "/project/{projectId}",
  tags: ["GitLab"],
  summary: "Get GitLab integration",
  description:
    "Get the GitLab integration for a project, or null when none is configured. The webhook secret is included only for callers with workspace:manage_settings.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "GitLab integration details, or null",
      gitlabIntegrationSchema.nullable(),
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createIntegrationRoute = createRoute({
  method: "post",
  operationId: "createGitlabIntegration",
  path: "/project/{projectId}",
  tags: ["GitLab"],
  summary: "Create GitLab integration",
  description:
    "Link a project to a GitLab project. Use the verify route first to confirm the token really reaches it, then add the returned webhook URL and secret token in GitLab.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createGitlabBody } },
    },
  },
  responses: {
    200: jsonResponse("The stored integration", gitlabIntegrationSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    409: errorResponse(
      "The GitLab project is already linked to another Kaneo project",
    ),
  },
});

const updateIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateGitlabIntegration",
  path: "/project/{projectId}",
  tags: ["GitLab"],
  summary: "Update GitLab integration",
  description:
    "Update the GitLab integration. Omitted fields keep their current value.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateGitlabBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated integration", gitlabIntegrationSchema),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: jsonResponse("Integration not found", integrationNotFoundSchema),
  },
});

const deleteIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteGitlabIntegration",
  path: "/project/{projectId}",
  tags: ["GitLab"],
  summary: "Delete GitLab integration",
  description: "Unlink a project from its GitLab project.",
  middleware: manageAccess,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("The integration was removed", gitlabDeleteResultSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: errorResponse("GitLab integration not found"),
  },
});

const importIssuesRoute = createRoute({
  method: "post",
  operationId: "importGitlabIssues",
  path: "/import-issues",
  tags: ["GitLab"],
  summary: "Import GitLab issues",
  description:
    "Import the linked project's issues as tasks. Issues that already have a task are refreshed rather than duplicated.",
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
    200: jsonResponse("Import summary", gitlabImportResultSchema),
    400: errorResponse("projectId is required"),
    403: errorResponse(
      "No workspace access, or missing task:create permission",
    ),
    404: errorResponse("Project not found"),
  },
});

const gitlabIntegration = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listProjectsRoute, async (c) => {
    const { baseUrl, accessToken, tokenType } = c.req.valid("json");
    const result = await listGitlabProjects({
      baseUrl,
      accessToken,
      tokenType,
    });
    return c.json(result, 200);
  })
  .openapi(verifyRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await verifyGitlabAccess(body);
    return c.json(result, 200);
  })
  .openapi(getIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const includeWebhookSecret = await hasWorkspacePermission(c, {
      workspace: ["manage_settings"],
    });
    const integration = await getGitlabIntegration(
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
    await createGitlabIntegration({
      projectId,
      baseUrl: body.baseUrl,
      accessToken: body.accessToken,
      tokenType: body.tokenType,
      namespace: body.namespace,
      projectPath: body.projectPath,
    });
    const integration = await getGitlabIntegration(projectId, true);
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
        eq(integrationTable.type, "gitlab"),
      ),
    });

    if (!row) {
      return c.json({ error: "Integration not found" }, 404);
    }

    let config: GitlabConfig;
    try {
      config = JSON.parse(row.config) as GitlabConfig;
    } catch {
      throw new HTTPException(500, { message: "Invalid integration config" });
    }

    if (body.commentTaskLinkOnGitlabIssue !== undefined) {
      config = {
        ...config,
        commentTaskLinkOnGitlabIssue: body.commentTaskLinkOnGitlabIssue,
      };
    }

    const validation = await validateGitlabConfig(config);
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
          eq(integrationTable.type, "gitlab"),
        ),
      );

    const updated = await getGitlabIntegration(projectId, true);
    if (!updated) {
      throw new HTTPException(500, { message: "Failed to load integration" });
    }
    return c.json(updated, 200);
  })
  .openapi(deleteIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const result = await deleteGitlabIntegration(projectId);
    return c.json(result, 200);
  })
  .openapi(importIssuesRoute, async (c) => {
    const { projectId } = c.req.valid("json");
    const result = await importGitlabIssues(projectId);
    return c.json(result, 200);
  });

export async function handleGitlabWebhookRoute(c: Context) {
  const integrationId = c.req.param("integrationId");
  if (!integrationId) {
    return c.json({ error: "Missing integration id" }, 400);
  }

  const arrayBuffer = await c.req.arrayBuffer();
  const body = Buffer.from(arrayBuffer).toString("utf8");

  const token =
    c.req.header("x-gitlab-token") || c.req.header("X-Gitlab-Token");

  const eventName =
    c.req.header("x-gitlab-event") || c.req.header("X-Gitlab-Event");

  const result = await handleGitlabWebhookRequest(
    integrationId,
    body,
    token,
    eventName,
  );

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ status: "success" });
}

export default gitlabIntegration;
