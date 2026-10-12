import { and, eq } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { publishEvent } from "../events";
import { integrationTable } from "../database/schema";
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
  type GitlabConfig,
  validateGitlabConfig,
} from "../plugins/gitlab/config";
import { tokenTypeOf } from "../plugins/gitlab/utils/gitlab-api";
import { handleGitlabWebhookRequest } from "../plugins/gitlab/webhook-handler";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createGitlabIntegration from "./controllers/create-gitlab-integration";
import deleteGitlabIntegration from "./controllers/delete-gitlab-integration";
import getGitlabIntegration, {
  getGitlabIntegrationById,
  listGitlabIntegrations,
} from "./controllers/get-gitlab-integration";
import { importGitlabIssues } from "./controllers/import-gitlab-issues";
import listGitlabProjects from "./controllers/list-gitlab-projects";
import verifyGitlabAccess from "./controllers/verify-gitlab-access";
import {
  gitlabDeleteResultSchema,
  gitlabImportResultSchema,
  gitlabIntegrationListSchema,
  gitlabIntegrationSchema,
  gitlabProjectListSchema,
  gitlabVerificationResultSchema,
} from "./response";
import {
  createGitlabBody,
  importGitlabIssuesBody,
  listGitlabProjectsBody,
  updateGitlabBody,
  verifyGitlabBody,
} from "./schema";

const manageAccess = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const manageBindingAccess = [
  workspaceAccess.fromIntegration("integrationId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const listProjectsRoute = createRoute({
  method: "post",
  operationId: "listGitlabProjects",
  path: "/projects",
  tags: ["GitLab"],
  summary: "List GitLab projects",
  description:
    "List the projects a GitLab token is a member of, for picking one to link. Sent as a POST because the token travels in the body rather than the URL. Each project is annotated with its linked state (linkedTo); same-project links block selection, cross-project links are informational only (RFC decision D1).",
  middleware: manageAccess,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: listGitlabProjectsBody } },
    },
  },
  responses: {
    200: jsonResponse("Accessible projects", gitlabProjectListSchema),
    400: errorResponse("Invalid body"),
    401: errorResponse(
      "GitLab rejected the token, or the instance is unreachable",
    ),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
  },
});

const verifyRoute = createRoute({
  method: "post",
  operationId: "verifyGitlabAccess",
  path: "/verify",
  tags: ["GitLab"],
  summary: "Verify GitLab access",
  description:
    "Check that the base URL is a GitLab instance and that the token can reach the project with the permissions Kaneo needs. An unreachable instance, a missing project, or insufficient permissions are reported in a 200 body so the form can explain them; a token GitLab rejects outright is a 401.",
  middleware: manageAccess,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: verifyGitlabBody } },
    },
  },
  responses: {
    200: jsonResponse("Verification result", gitlabVerificationResultSchema),
    400: errorResponse("Invalid body"),
    401: errorResponse("GitLab rejected the token"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
  },
});

// RFC 0001 WP4: list every GitLab binding of the project, oldest first,
// together with the WP10 repository binding usage summary.
const listIntegrationsRoute = createRoute({
  method: "get",
  operationId: "listGitlabIntegrations",
  path: "/project/{projectId}/integrations",
  tags: ["GitLab"],
  summary: "List GitLab integrations",
  description:
    "List every GitLab project bound to the project, oldest first, together with the workspace's repository binding usage summary (WP10).",
  middleware: manageAccess,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "The project's GitLab bindings and the repository binding usage",
      gitlabIntegrationListSchema,
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
  operationId: "getGitlabIntegrationById",
  path: "/integration/{integrationId}",
  tags: ["GitLab"],
  summary: "Get a GitLab integration by id",
  description:
    "Get one GitLab project binding, or null when the id does not exist. Authorization resolves integration -> project -> workspace (WP1).",
  middleware: manageBindingAccess,
  request: { params: integrationIdParam },
  responses: {
    200: jsonResponse(
      "GitLab integration details, or null",
      gitlabIntegrationSchema.nullable(),
    ),
    403: errorResponse("No access to the integration's workspace"),
    404: errorResponse("Integration not found"),
  },
});

const getIntegrationRoute = createRoute({
  method: "get",
  operationId: "getGitlabIntegration",
  path: "/project/{projectId}",
  tags: ["GitLab"],
  summary: "Get GitLab integration",
  description:
    "Compatibility shim: returns the project's first GitLab binding (lowest createdAt) until the new web client ships. Use GET /project/{projectId}/integrations and GET /integration/{integrationId}; this route is removed in the cleanup PR.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "GitLab integration details, or null",
      gitlabIntegrationSchema.nullable(),
    ),
    403: errorResponse("No access to the project"),
    404: errorResponse("Project not found"),
  },
});

const createIntegrationRoute = createRoute({
  method: "post",
  operationId: "createGitlabIntegration",
  path: "/project/{projectId}",
  tags: ["GitLab"],
  summary: "Create GitLab integration",
  description:
    "Link a project to one GitLab project. A project can hold multiple repository bindings, and the same GitLab project may be linked in other projects (decision D1); only same-project duplicates are rejected. Kaneo generates the per-binding secret GitLab must send with each webhook; add the webhook in GitLab afterwards.",
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
    409: errorResponse(
      "The GitLab project is already linked to this project (repository_already_linked)",
    ),
    402: errorResponse(
      "The plan's repository binding limit is reached (binding_limit_exceeded)",
    ),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    409: errorResponse(
      "That GitLab project is already linked to another Kaneo project",
    ),
    404: errorResponse("Project not found"),
  },
});

const updateIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateGitlabIntegration",
  path: "/integration/{integrationId}",
  tags: ["GitLab"],
  summary: "Update GitLab integration",
  description:
    "Update one GitLab project binding by id. Omitted fields keep their current value. Reactivating an inactive binding (isActive false to true) enforces the plan's repository binding quota first.",
  middleware: manageBindingAccess,
  request: {
    params: integrationIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateGitlabBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated integration", gitlabIntegrationSchema),
    409: errorResponse("Integration changed; refresh before updating settings"),
    402: errorResponse(
      "The plan's repository binding limit is reached (binding_limit_exceeded)",
    ),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project or integration not found"),
    409: errorResponse("Integration changed; refresh before updating settings"),
  },
});

const deleteIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteGitlabIntegration",
  path: "/integration/{integrationId}",
  tags: ["GitLab"],
  summary: "Delete GitLab integration",
  description:
    "Unlink one GitLab project binding. Its external links are removed with it; tasks created from its issues remain in the project. Other bindings of the project stay fully functional.",
  middleware: manageBindingAccess,
  request: { params: integrationIdParam },
  responses: {
    200: jsonResponse("The integration was removed", gitlabDeleteResultSchema),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project or GitLab integration not found"),
  },
});

const importIssuesRoute = createRoute({
  method: "post",
  operationId: "importGitlabIssues",
  path: "/import-issues",
  tags: ["GitLab"],
  summary: "Import GitLab issues",
  description:
    "Import the linked project's open issues as tasks for one binding (integrationId). Issues that already have a task are refreshed rather than duplicated. A projectId in the body is accepted for compat and must match the binding's project.",
  middleware: [
    workspaceAccess.fromIntegration("integrationId"),
    requireWorkspacePermission({ task: ["create", "update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: importGitlabIssuesBody } },
    },
  },
  responses: {
    200: jsonResponse("Import summary", gitlabImportResultSchema),
    400: errorResponse("integrationId is required, or binding mismatch"),
    403: errorResponse(
      "No access to the project, or missing task:create or task:update permission",
    ),
    404: errorResponse("Integration or project not found"),
  },
});

const gitlabIntegration = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listProjectsRoute, async (c) => {
    const { baseUrl, accessToken, tokenType, projectId } = c.req.valid("json");
    const result = await listGitlabProjects({
      baseUrl,
      accessToken,
      tokenType: tokenTypeOf({ tokenType }),
      projectId,
    });
    return c.json(result, 200);
  })
  .openapi(verifyRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await verifyGitlabAccess({
      ...body,
      tokenType: tokenTypeOf(body),
    });
    return c.json(result, 200);
  })
  .openapi(listIntegrationsRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const integrations = await listGitlabIntegrations(projectId);
    const usage = await getRepositoryBindingUsage(
      projectId,
      c.get("workspaceId"),
    );
    return c.json({ integrations, usage }, 200);
  })
  .openapi(getIntegrationByIdRoute, async (c) => {
    const { integrationId } = c.req.valid("param");
    const integration = await getGitlabIntegrationById(integrationId, true);
    return c.json(integration, 200);
  })
  .openapi(getIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const includeSecrets = await hasWorkspacePermission(c, {
      workspace: ["manage_settings"],
    });
    const integration = await getGitlabIntegration(projectId, includeSecrets);
    return c.json(integration, 200);
  })
  .openapi(createIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    const created = await createGitlabIntegration({
      projectId,
      baseUrl: body.baseUrl,
      accessToken: body.accessToken,
      tokenType: tokenTypeOf(body),
      projectPath: body.projectPath,
    });
    const integration = await getGitlabIntegrationById(created.id, true);
    if (!integration) {
      throw new HTTPException(500, { message: "Failed to load integration" });
    }
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

    // WP10: reactivation re-enters the binding count, so the quota guard
    // runs before the update writes isActive=true.
    if (body.isActive === true && !row.isActive) {
      await assertRepositoryBindingQuota(row.projectId, c.get("workspaceId"));
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
        message: "Integration changed; refresh before updating settings",
      });

    const updated = await getGitlabIntegrationById(row.id, true);
    if (!updated) {
      throw new HTTPException(500, { message: "Failed to load integration" });
    }
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
    const result = await deleteGitlabIntegration(integrationId);
    return c.json(result, 200);
  })
  .openapi(importIssuesRoute, async (c) => {
    const { integrationId, projectId } = c.req.valid("json");
    const result = await importGitlabIssues({ integrationId, projectId });
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

  const result = await handleGitlabWebhookRequest(integrationId, body, token);

  if (!result.success) {
    return c.json({ error: result.error }, result.status ?? 400);
  }

  return c.json({ status: "success" });
}

export default gitlabIntegration;
