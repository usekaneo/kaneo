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
  type GiteaConfig,
  validateGiteaConfig,
} from "../plugins/gitea/config";
import { handleGiteaWebhookRequest } from "../plugins/gitea/webhook-handler";
import {
  hasWorkspacePermission,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createGiteaIntegration from "./controllers/create-gitea-integration";
import deleteGiteaIntegration from "./controllers/delete-gitea-integration";
import getGiteaIntegration, {
  getGiteaIntegrationById,
  listGiteaIntegrations,
} from "./controllers/get-gitea-integration";
import { importGiteaIssues } from "./controllers/import-gitea-issues";
import listGiteaRepositories from "./controllers/list-gitea-repositories";
import { resolveVerificationToken } from "./controllers/resolve-verification-token";
import verifyGiteaAccess from "./controllers/verify-gitea-access";
import {
  giteaDeleteResultSchema,
  giteaImportResultSchema,
  giteaIntegrationListSchema,
  giteaIntegrationSchema,
  giteaRepositoryListSchema,
  giteaVerificationResultSchema,
} from "./response";
import {
  createGiteaBody,
  importGiteaIssuesBody,
  listGiteaRepositoriesBody,
  updateGiteaBody,
  verifyGiteaBody,
} from "./schema";

const manageAccess = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const manageBindingAccess = [
  workspaceAccess.fromIntegration("integrationId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const listRepositoriesRoute = createRoute({
  method: "post",
  operationId: "listGiteaRepositories",
  path: "/repositories",
  tags: ["Gitea"],
  summary: "List Gitea repositories",
  description:
    "List the repositories a Gitea token can reach, for picking one to link. Sent as a POST because the token travels in the body rather than the URL. Each repository is annotated with its linked state (linkedTo); same-project links block selection, cross-project links are informational only (RFC decision D1).",
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

// RFC 0001 WP3: list every Gitea binding of the project, oldest first,
// together with the WP10 repository binding usage summary.
const listIntegrationsRoute = createRoute({
  method: "get",
  operationId: "listGiteaIntegrations",
  path: "/project/{projectId}/integrations",
  tags: ["Gitea"],
  summary: "List Gitea integrations",
  description:
    "List every Gitea repository bound to the project, oldest first, together with the workspace's repository binding usage summary (WP10).",
  middleware: manageAccess,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "The project's Gitea bindings and the repository binding usage",
      giteaIntegrationListSchema,
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
  operationId: "getGiteaIntegrationById",
  path: "/integration/{integrationId}",
  tags: ["Gitea"],
  summary: "Get a Gitea integration by id",
  description:
    "Get one Gitea repository binding, or null when the id does not exist. Authorization resolves integration -> project -> workspace (WP1).",
  middleware: manageBindingAccess,
  request: { params: integrationIdParam },
  responses: {
    200: jsonResponse(
      "Gitea integration details, or null",
      giteaIntegrationSchema.nullable(),
    ),
    403: errorResponse("No access to the integration's workspace"),
    404: errorResponse("Integration not found"),
  },
});

const getIntegrationRoute = createRoute({
  method: "get",
  operationId: "getGiteaIntegration",
  path: "/project/{projectId}",
  tags: ["Gitea"],
  summary: "Get Gitea integration",
  description:
    "Compatibility shim: returns the project's first Gitea binding (lowest createdAt) until the new web client ships. Use GET /project/{projectId}/integrations and GET /integration/{integrationId}; this route is removed in the cleanup PR.",
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
    "Link a project to one Gitea repository. A project can hold multiple repository bindings, and the same repository may be linked in other projects (decision D1); only same-project duplicates are rejected. Each binding gets its own webhook secret and webhook route.",
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
    409: errorResponse(
      "The repository is already linked to this project (repository_already_linked)",
    ),
    402: errorResponse(
      "The plan's repository binding limit is reached (binding_limit_exceeded)",
    ),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: errorResponse("Project not found"),
  },
});

const updateIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateGiteaIntegration",
  path: "/integration/{integrationId}",
  tags: ["Gitea"],
  summary: "Update Gitea integration",
  description:
    "Update one Gitea repository binding by id. Omitted fields keep their current value. Reactivating an inactive binding (isActive false to true) enforces the plan's repository binding quota first.",
  middleware: manageBindingAccess,
  request: {
    params: integrationIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateGiteaBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated integration", giteaIntegrationSchema),
    409: errorResponse("Integration changed; refresh before updating settings"),
    402: errorResponse(
      "The plan's repository binding limit is reached (binding_limit_exceeded)",
    ),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No access to the project, or missing workspace:manage_settings",
    ),
    404: jsonResponse("Integration not found", integrationNotFoundSchema),
  },
});

const deleteIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteGiteaIntegration",
  path: "/integration/{integrationId}",
  tags: ["Gitea"],
  summary: "Delete Gitea integration",
  description:
    "Unlink one Gitea repository binding. Its external links are removed with it; tasks created from its issues remain in the project. Other bindings of the project stay fully functional.",
  middleware: manageBindingAccess,
  request: { params: integrationIdParam },
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
    "Import the linked repository's issues as tasks for one binding (integrationId). Issues that already have a task are refreshed rather than duplicated. A projectId in the body is accepted for compat and must match the binding's project.",
  middleware: [
    workspaceAccess.fromIntegration("integrationId"),
    requireWorkspacePermission({ task: ["create", "update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: importGiteaIssuesBody } },
    },
  },
  responses: {
    200: jsonResponse("Import summary", giteaImportResultSchema),
    400: errorResponse("integrationId is required, or binding mismatch"),
    403: errorResponse(
      "No access to the project, or missing task:create or task:update permission",
    ),
    404: errorResponse("Integration or project not found"),
  },
});

const giteaIntegration = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listRepositoriesRoute, async (c) => {
    const { baseUrl, accessToken, projectId } = c.req.valid("json");
    const result = await listGiteaRepositories({
      baseUrl,
      accessToken,
      projectId,
    });
    return c.json(result, 200);
  })
  .openapi(verifyRoute, async (c) => {
    const body = c.req.valid("json");
    const accessToken = await resolveVerificationToken(body);
    const result = await verifyGiteaAccess({ ...body, accessToken });
    return c.json(result, 200);
  })
  .openapi(listIntegrationsRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const integrations = await listGiteaIntegrations(projectId);
    const usage = await getRepositoryBindingUsage(
      projectId,
      c.get("workspaceId"),
    );
    return c.json({ integrations, usage }, 200);
  })
  .openapi(getIntegrationByIdRoute, async (c) => {
    const { integrationId } = c.req.valid("param");
    const integration = await getGiteaIntegrationById(integrationId, true);
    return c.json(integration, 200);
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
    return c.json(integration, 200);
  })
  .openapi(createIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");
    const created = await createGiteaIntegration({
      projectId,
      baseUrl: body.baseUrl,
      accessToken: body.accessToken,
      repositoryOwner: body.repositoryOwner,
      repositoryName: body.repositoryName,
    });
    const integration = await getGiteaIntegrationById(created.id, true);
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

    const updated = await getGiteaIntegrationById(row.id, true);
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
    const result = await deleteGiteaIntegration(integrationId);
    return c.json(result, 200);
  })
  .openapi(importIssuesRoute, async (c) => {
    const { integrationId, projectId } = c.req.valid("json");
    const result = await importGiteaIssues({ integrationId, projectId });
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
