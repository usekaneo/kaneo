import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { integrationTable } from "../database/schema";
import { deletedSchema, projectIdParam } from "../integrations/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import {
  defaultMattermostEvents,
  type MattermostConfig,
  normalizeMattermostConfig,
  validateMattermostConfig,
} from "../plugins/mattermost/config";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { mattermostIntegrationSchema } from "./response";
import { createMattermostBody, updateMattermostBody } from "./schema";

function maskWebhookUrl(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    const maskedLast =
      last.length > 8 ? `${last.slice(0, 4)}…${last.slice(-4)}` : "••••";
    return `${url.origin}/${parts.slice(0, -1).join("/")}/${maskedLast}`;
  } catch {
    return "Configured";
  }
}

function toResponse(integration: {
  id: string;
  projectId: string;
  config: string;
  isActive: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const config = normalizeMattermostConfig(
    JSON.parse(integration.config) as MattermostConfig,
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    channelName: config.channelName ?? null,
    webhookConfigured: Boolean(config.webhookUrl),
    maskedWebhookUrl: maskWebhookUrl(config.webhookUrl),
    events: {
      ...defaultMattermostEvents,
      ...(config.events ?? {}),
    },
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

async function getMattermostIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "mattermost"),
    ),
  });

  if (!integration) {
    return null;
  }

  return toResponse(integration);
}

const manageAccess = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const getMattermostIntegrationRoute = createRoute({
  method: "get",
  operationId: "getMattermostIntegration",
  path: "/project/{projectId}",
  tags: ["Mattermost"],
  summary: "Get Mattermost integration",
  description:
    "Get the Mattermost integration for a project, or null when none is configured.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Mattermost integration details, or null",
      mattermostIntegrationSchema.nullable(),
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createMattermostIntegrationRoute = createRoute({
  method: "post",
  operationId: "createMattermostIntegration",
  path: "/project/{projectId}",
  tags: ["Mattermost"],
  summary: "Create Mattermost integration",
  description:
    "Create or replace the Mattermost integration for a project. The webhook URL must use HTTPS and pass destination validation; delivery failures surface later.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createMattermostBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The stored integration",
      mattermostIntegrationSchema.nullable(),
    ),
    400: errorResponse("The webhook URL failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const updateMattermostIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateMattermostIntegration",
  path: "/project/{projectId}",
  tags: ["Mattermost"],
  summary: "Update Mattermost integration",
  description:
    "Update the Mattermost integration. Omitted fields keep their current value, and event toggles are merged into the existing set.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateMattermostBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The updated integration",
      mattermostIntegrationSchema.nullable(),
    ),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: errorResponse("Mattermost integration not found"),
  },
});

const deleteMattermostIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteMattermostIntegration",
  path: "/project/{projectId}",
  tags: ["Mattermost"],
  summary: "Delete Mattermost integration",
  description: "Remove the Mattermost integration from a project.",
  middleware: manageAccess,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("The integration was removed", deletedSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: errorResponse("Mattermost integration not found"),
  },
});

const mattermostIntegration = apiRouter<
  BaseVariables & { workspaceId: string }
>()
  .openapi(getMattermostIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const integration = await getMattermostIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(createMattermostIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const config = normalizeMattermostConfig({
      webhookUrl: body.webhookUrl,
      channelName: body.channelName,
      events: body.events,
    });

    const validation = await validateMattermostConfig(config);
    if (!validation.valid) {
      throw new HTTPException(400, {
        message: validation.errors?.join(", ") ?? "Invalid config",
      });
    }

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "mattermost"),
      ),
    });

    if (existing) {
      await db
        .update(integrationTable)
        .set({
          config: JSON.stringify(config),
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(integrationTable.id, existing.id));
    } else {
      await db.insert(integrationTable).values({
        projectId,
        type: "mattermost",
        config: JSON.stringify(config),
        isActive: true,
      });
    }

    const integration = await getMattermostIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(updateMattermostIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "mattermost"),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, {
        message: "Mattermost integration not found",
      });
    }

    const currentConfig = normalizeMattermostConfig(
      JSON.parse(existing.config) as MattermostConfig,
    );
    const nextConfig = normalizeMattermostConfig({
      webhookUrl:
        body.webhookUrl === undefined
          ? currentConfig.webhookUrl
          : body.webhookUrl.trim(),
      channelName:
        body.channelName === undefined
          ? currentConfig.channelName
          : (body.channelName ?? undefined),
      events: {
        ...(currentConfig.events ?? {}),
        ...(body.events ?? {}),
      },
    });

    const validation = await validateMattermostConfig(nextConfig);
    if (!validation.valid) {
      throw new HTTPException(400, {
        message: validation.errors?.join(", ") ?? "Invalid config",
      });
    }

    await db
      .update(integrationTable)
      .set({
        config: JSON.stringify(nextConfig),
        isActive:
          body.isActive !== undefined
            ? body.isActive
            : (existing.isActive ?? true),
        updatedAt: new Date(),
      })
      .where(eq(integrationTable.id, existing.id));

    const integration = await getMattermostIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(deleteMattermostIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "mattermost"),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, {
        message: "Mattermost integration not found",
      });
    }

    await db
      .delete(integrationTable)
      .where(eq(integrationTable.id, existing.id));
    return c.json({ success: true }, 200);
  });

export default mattermostIntegration;
