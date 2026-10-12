import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { publishEvent } from "../events";
import { accountTable, integrationTable } from "../database/schema";
import { scopeToProjectFromBody } from "../integrations/middleware";
import { integrationIdParam, projectIdParam } from "../integrations/schema";
import {
  getRepositoryBindingUsage,
  assertRepositoryBindingQuota,
} from "../plan-limits/repository-binding-quota";
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
import getGithubIntegration, {
  getGithubIntegrationById,
  listGithubIntegrations,
} from "./controllers/get-github-integration";
import { importIssues } from "./controllers/import-issues";
import listUserRepositories from "./controllers/list-user-repositories";
import verifyGithubInstallation from "./controllers/verify-github-installation";
import { verifyRepositoryOwner } from "./controllers/verify-repository-owner";
import {
  createdGithubIntegrationSchema,
  deleteResultSchema,
  githubAppInfoSchema,
  githubIntegrationListSchema,
  githubIntegrationSchema,
  githubRepositoryListSchema,
  importResultSchema,
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
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
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
    400: errorResponse("Invalid body"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
  },
});

const listIntegrationsRoute = createRoute({
  method: "get",
  operationId: "listGitHubIntegrations",
  path: "/project/{projectId}/integrations",
  tags: ["GitHub"],
  summary: "List GitHub integrations",
  description:
    "List every GitHub repository bound to the project, oldest first, together with the workspace's repository binding usage summary (WP10).",
  middleware: [requireUserSession, ...manageAccess],
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "The project's GitHub bindings and the repository binding usage",
      githubIntegrationListSchema,
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const getIntegrationByIdRoute = createRoute({
  method: "get",
  operationId: "getGitHubIntegrationById",
  path: "/integration/{integrationId}",
  tags: ["GitHub"],
  summary: "Get a GitHub integration by id",
  description:
    "Get one GitHub repository binding, or null when the id does not exist. Authorization resolves integration -> project -> workspace (WP1).",
  middleware: [
    workspaceAccess.fromIntegration("integrationId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: integrationIdParam },
  responses: {
    200: jsonResponse(
      "GitHub integration details, or null",
      githubIntegrationSchema.nullable(),
    ),
    403: errorResponse("No access to the integration's workspace"),
    404: errorResponse("Integration not found"),
  },
});

const getIntegrationRoute = createRoute({
  method: "get",
  operationId: "getGitHubIntegration",
  path: "/project/{projectId}",
  tags: ["GitHub"],
  summary: "Get GitHub integration",
  description:
    "Compatibility shim: returns the project's first GitHub binding (lowest createdAt) until the new web client ships. Use GET /project/{projectId}/integrations and GET /integration/{integrationId}; this route is removed in the cleanup PR.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "GitHub integration details, or null",
      githubIntegrationSchema.nullable(),
    ),
    403: errorResponse("No access to the project"),
    404: errorResponse("Project not found"),
  },
});

const createIntegrationRoute = createRoute({
  method: "post",
  operationId: "createGitHubIntegration",
  path: "/project/{projectId}",
  tags: ["GitHub"],
  summary: "Create GitHub integration",
  description:
    "Link a project to one GitHub repository. A project can hold multiple repository bindings, and the same repository may be linked in other projects (decision D1); only same-project duplicates are rejected. Existing issue and pull request links are kept per binding.",
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
      "The repository is already linked to this project (repository_already_linked)",
    ),
    402: errorResponse(
      "The plan's repository binding limit is reached (binding_limit_exceeded)",
    ),
    400: errorResponse("Invalid body"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
  },
});

const updateIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateGitHubIntegration",
  path: "/integration/{integrationId}",
  tags: ["GitHub"],
  summary: "Update GitHub integration",
  description:
    "Update one GitHub repository binding by id. Omitted fields keep their current value. Reactivating an inactive binding (isActive false to true) enforces the plan's repository binding quota first.",
  middleware: [
    workspaceAccess.fromIntegration("integrationId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    params: integrationIdParam,
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
      "Integration changed; refresh before updating",
    ),
    402: errorResponse(
      "The plan's repository binding limit is reached (binding_limit_exceeded)",
    ),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project or integration not found"),
  },
});

const deleteIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteGitHubIntegration",
  path: "/integration/{integrationId}",
  tags: ["GitHub"],
  summary: "Delete GitHub integration",
  description:
    "Unlink one GitHub repository binding. Its issue and pull request links and import state are removed with it; tasks created from its issues remain in the project.",
  middleware: [
    workspaceAccess.fromIntegration("integrationId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: { params: integrationIdParam },
  responses: {
    200: jsonResponse("The integration was removed", deleteResultSchema),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project or GitHub integration not found"),
  },
});

const importIssuesRoute = createRoute({
  method: "post",
  operationId: "importGitHubIssues",
  path: "/import-issues",
  tags: ["GitHub"],
  summary: "Import GitHub issues",
  description:
    "Import open issues and link open pull requests for one repository binding (integrationId) in bounded steps. Existing tasks are updated. Continue 202 responses with the returned runId until 200; the same runId safely retries completion. Progress is saved after each page and is per binding. A projectId in the body is accepted for compat and must match the binding's project.",
  middleware: [
    workspaceAccess.fromIntegration("integrationId"),
    requireWorkspacePermission({ task: ["create", "update"] }),
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
    400: errorResponse("integrationId is required"),
    403: errorResponse(
      "No access to the project, or missing task:create or task:update permission",
    ),
    404: errorResponse("Integration not found"),
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
  .openapi(listIntegrationsRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const integrations = await listGithubIntegrations(projectId);
    const usage = await getRepositoryBindingUsage(
      projectId,
      c.get("workspaceId"),
    );
    return c.json({ integrations, usage }, 200);
  })
  .openapi(getIntegrationByIdRoute, async (c) => {
    const { integrationId } = c.req.valid("param");
    const integration = await getGithubIntegrationById(integrationId);
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

    if (integration)
      await publishEvent("integration.sync_rules_changed", {
        projectId,
        integrationId: integration.id,
      });
    return c.json(integration, 200);
  })
  .openapi(updateIntegrationRoute, async (c) => {
    const { integrationId } = c.req.valid("param");
    const body = c.req.valid("json");

    const row = await db.query.integrationTable.findFirst({
      where: eq(integrationTable.id, integrationId),
    });

    if (!row) {
      throw new HTTPException(404, { message: "Integration not found" });
    }

    // WP10: reactivation re-enters the binding count, so the quota guard runs
    // before the update writes isActive=true.
    if (body.isActive === true && !row.isActive) {
      await assertRepositoryBindingQuota(row.projectId, c.get("workspaceId"));
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

    const updated = await getGithubIntegrationById(row.id);
    if (body.isActive === true && !row.isActive)
      await publishEvent("integration.sync_rules_changed", {
        projectId: row.projectId,
        integrationId: row.id,
      });
    await publishEvent("project.updated", {
      projectId: row.projectId,
      linksChanged: true,
    });
    return c.json(updated, 200);
  })
  .openapi(deleteIntegrationRoute, async (c) => {
    const { integrationId } = c.req.valid("param");
    const result = await deleteGithubIntegration(integrationId);
    return c.json(result, 200);
  })
  .openapi(importIssuesRoute, async (c) => {
    const { integrationId, projectId, runId } = c.req.valid("json");
    const result = await importIssues({
      integrationId,
      projectId,
      runId,
    });
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
