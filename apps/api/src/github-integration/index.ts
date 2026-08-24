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
  type GitHubConfig,
  validateGitHubConfig,
} from "../plugins/github/config";
import { handleGitHubWebhook } from "../plugins/github/webhook-handler";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createGithubIntegration from "./controllers/create-github-integration";
import deleteGithubIntegration from "./controllers/delete-github-integration";
import getGithubIntegration from "./controllers/get-github-integration";
import { importIssues } from "./controllers/import-issues";
import listUserRepositories from "./controllers/list-user-repositories";
import verifyGithubInstallation from "./controllers/verify-github-installation";
import {
  createdGithubIntegrationSchema,
  deleteResultSchema,
  githubAppInfoSchema,
  githubIntegrationSchema,
  githubRepositoryListSchema,
  importResultSchema,
  integrationNotFoundSchema,
  verificationResultSchema,
} from "./response";
import { createGitHubBody, updateGitHubBody, verifyGitHubBody } from "./schema";

const manageAccess = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const getAppInfoRoute = createRoute({
  method: "get",
  operationId: "getGitHubAppInfo",
  path: "/app-info",
  tags: ["GitHub"],
  summary: "Get GitHub app info",
  description:
    "Get the GitHub App this instance is configured with, so the client can build an install link.",
  responses: {
    200: jsonResponse("GitHub app information", githubAppInfoSchema),
  },
});

const listRepositoriesRoute = createRoute({
  method: "get",
  operationId: "listGitHubRepositories",
  path: "/repositories/{projectId}",
  tags: ["GitHub"],
  summary: "List GitHub repositories",
  description:
    "List the repositories reachable through the installed GitHub App, for picking one to link.",
  middleware: manageAccess,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Repositories reachable through the installed App",
      githubRepositoryListSchema,
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const verifyRoute = createRoute({
  method: "post",
  operationId: "verifyGitHubInstallation",
  path: "/verify",
  tags: ["GitHub"],
  summary: "Verify GitHub installation",
  description:
    "Check that the GitHub App is installed on a repository and holds the permissions Kaneo needs. Always 200 -- problems are reported in the body so the client can guide the user.",
  middleware: manageAccess,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: verifyGitHubBody } },
    },
  },
  responses: {
    200: jsonResponse("Verification result", verificationResultSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const getIntegrationRoute = createRoute({
  method: "get",
  operationId: "getGitHubIntegration",
  path: "/project/{projectId}",
  tags: ["GitHub"],
  summary: "Get GitHub integration",
  description:
    "Get the GitHub integration for a project, or null when none is configured.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "GitHub integration details, or null",
      githubIntegrationSchema.nullable(),
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createIntegrationRoute = createRoute({
  method: "post",
  operationId: "createGitHubIntegration",
  path: "/project/{projectId}",
  tags: ["GitHub"],
  summary: "Create GitHub integration",
  description: "Link a project to a GitHub repository.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createGitHubBody } },
    },
  },
  responses: {
    200: jsonResponse("The stored integration", createdGithubIntegrationSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const updateIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateGitHubIntegration",
  path: "/project/{projectId}",
  tags: ["GitHub"],
  summary: "Update GitHub integration",
  description:
    "Update the GitHub integration. Omitted fields keep their current value.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateGitHubBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The updated integration",
      githubIntegrationSchema.nullable(),
    ),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: jsonResponse("Integration not found", integrationNotFoundSchema),
  },
});

const deleteIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteGitHubIntegration",
  path: "/project/{projectId}",
  tags: ["GitHub"],
  summary: "Delete GitHub integration",
  description: "Unlink a project from its GitHub repository.",
  middleware: manageAccess,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("The integration was removed", deleteResultSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: errorResponse("GitHub integration not found"),
  },
});

const importIssuesRoute = createRoute({
  method: "post",
  operationId: "importGitHubIssues",
  path: "/import-issues",
  tags: ["GitHub"],
  summary: "Import GitHub issues",
  description:
    "Import the linked repository's issues as tasks. Issues that already have a task are skipped.",
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
    200: jsonResponse("Import summary", importResultSchema),
    400: errorResponse("projectId is required"),
    403: errorResponse(
      "No workspace access, or missing task:create permission",
    ),
    404: errorResponse("Project not found"),
  },
});

const githubIntegration = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getAppInfoRoute, async (c) => {
    return c.json(
      {
        appName: process.env.GITHUB_APP_NAME || null,
      },
      200,
    );
  })
  .openapi(listRepositoriesRoute, async (c) => {
    const repositories = await listUserRepositories();
    return c.json(repositories, 200);
  })
  .openapi(verifyRoute, async (c) => {
    const { repositoryOwner, repositoryName } = c.req.valid("json");

    const verification = await verifyGithubInstallation({
      repositoryOwner,
      repositoryName,
    });

    return c.json(verification, 200);
  })
  .openapi(getIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const integration = await getGithubIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(createIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const { repositoryOwner, repositoryName } = c.req.valid("json");

    const integration = await createGithubIntegration({
      projectId,
      repositoryOwner,
      repositoryName,
    });

    return c.json(integration, 200);
  })
  .openapi(updateIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const row = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "github"),
      ),
    });

    if (!row) {
      return c.json({ error: "Integration not found" }, 404);
    }

    let config: GitHubConfig;
    try {
      config = JSON.parse(row.config) as GitHubConfig;
    } catch {
      throw new HTTPException(500, { message: "Invalid integration config" });
    }

    if (body.commentTaskLinkOnGitHubIssue !== undefined) {
      config = {
        ...config,
        commentTaskLinkOnGitHubIssue: body.commentTaskLinkOnGitHubIssue,
      };
    }

    const validation = await validateGitHubConfig(config);
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
          eq(integrationTable.type, "github"),
        ),
      );

    const updated = await getGithubIntegration(projectId);
    return c.json(updated, 200);
  })
  .openapi(deleteIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const result = await deleteGithubIntegration(projectId);
    return c.json(result, 200);
  })
  .openapi(importIssuesRoute, async (c) => {
    const { projectId } = c.req.valid("json");
    const result = await importIssues(projectId);
    return c.json(result, 200);
  });

export async function handleGithubWebhookRoute(c: Context) {
  const arrayBuffer = await c.req.arrayBuffer();
  const body = Buffer.from(arrayBuffer).toString("utf8");

  const signature = c.req.header("x-hub-signature-256");
  if (!signature) {
    return c.json({ error: "Missing signature" }, 400);
  }

  const eventName = c.req.header("x-github-event");
  if (!eventName) {
    return c.json({ error: "Missing event name" }, 400);
  }

  const deliveryId = c.req.header("x-github-delivery") || "";

  const result = await handleGitHubWebhook(
    body,
    signature,
    eventName,
    deliveryId,
  );

  if (!result.success) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ status: "success" });
}

export default githubIntegration;
