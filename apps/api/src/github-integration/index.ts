import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { accountTable, integrationTable } from "../database/schema";
import { scopeToProjectFromBody } from "../integrations/middleware";
import { projectIdParam } from "../integrations/schema";
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
import { isGithubSsoConfigured } from "../utils/github-sso-env";
import { requireUserSession } from "../utils/require-user-session";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createGithubIntegration from "./controllers/create-github-integration";
import deleteGithubIntegration from "./controllers/delete-github-integration";
import getGithubIntegration from "./controllers/get-github-integration";
import { importIssues } from "./controllers/import-issues";
import listUserRepositories from "./controllers/list-user-repositories";
import verifyGithubInstallation from "./controllers/verify-github-installation";
import { verifyRepositoryOwner } from "./controllers/verify-repository-owner";
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
import {
  createGitHubBody,
  importGitHubBody,
  repositoryPageQuery,
  updateGitHubBody,
  verifyGitHubBody,
} from "./schema";

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
  middleware: [requireUserSession, ...manageAccess],
  request: { params: projectIdParam, query: repositoryPageQuery },
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
  middleware: [
    requireUserSession,
    scopeToProjectFromBody,
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ],
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
  description:
    "Link a project to a GitHub repository. Disconnect first to switch repositories; existing issue and pull request links cannot be reused for another repository.",
  middleware: [requireUserSession, ...manageAccess],
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createGitHubBody } },
    },
  },
  responses: {
    200: jsonResponse("The stored integration", createdGithubIntegrationSchema),
    409: errorResponse(
      "Integration changed or another repository is already linked",
    ),
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
    409: errorResponse(
      "Integration changed or another repository is already linked",
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
    "Import open issues and link open pull requests in bounded steps. Existing tasks are updated. Continue 202 responses with the returned runId until 200; the same runId safely retries completion. Progress is saved after each page. New calls without runId resume an unfinished import or start a new one after completion.",
  middleware: [
    scopeToProjectFromBody,
    requireWorkspacePermission({ task: ["create"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: importGitHubBody } },
    },
  },
  responses: {
    200: jsonResponse("Completed import summary", importResultSchema),
    202: jsonResponse(
      "Saved import progress; continue with runId",
      importResultSchema,
    ),
    409: errorResponse(
      "Integration or import changed; refresh before resuming",
    ),
    429: errorResponse("Import busy; retry after one second"),
    502: errorResponse(
      "Provider unavailable or invalid page; progress is saved",
    ),
    400: errorResponse("projectId is required"),
    403: errorResponse(
      "No workspace access, or missing task:create permission",
    ),
    404: errorResponse("Project not found"),
  },
});

const githubIntegration = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getAppInfoRoute, async (c) => {
    const account = await db.query.accountTable.findFirst({
      where: and(
        eq(accountTable.userId, c.get("userId")),
        eq(accountTable.providerId, "github"),
      ),
      columns: { id: true },
    });
    return c.json(
      {
        appName: process.env.GITHUB_APP_NAME || null,
        accountConnected: Boolean(account),
        accountLinkingAvailable: isGithubSsoConfigured(),
      },
      200,
    );
  })
  .openapi(listRepositoriesRoute, async (c) => {
    const repositories = await listUserRepositories(
      c.get("userId"),
      c.req.valid("query"),
    );
    return c.json(repositories, 200);
  })
  .openapi(verifyRoute, async (c) => {
    const { repositoryOwner, repositoryName } = c.req.valid("json");

    await verifyRepositoryOwner(
      c.get("userId"),
      repositoryOwner,
      repositoryName,
    );
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
      userId: c.get("userId"),
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

    const [saved] = await db
      .update(integrationTable)
      .set({
        config: JSON.stringify(config),
        isActive:
          body.isActive !== undefined ? body.isActive : (row.isActive ?? true),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(integrationTable.id, row.id),
          eq(integrationTable.config, row.config),
        ),
      )
      .returning({ id: integrationTable.id });
    if (!saved)
      throw new HTTPException(409, {
        message: "GitHub integration changed; refresh before updating",
      });

    const updated = await getGithubIntegration(projectId);
    return c.json(updated, 200);
  })
  .openapi(deleteIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const result = await deleteGithubIntegration(projectId);
    return c.json(result, 200);
  })
  .openapi(importIssuesRoute, async (c) => {
    const { projectId, runId } = c.req.valid("json");
    const result = await importIssues(projectId, runId);
    return result.pending ? c.json(result, 202) : c.json(result, 200);
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
