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
  defaultSlackEvents,
  normalizeSlackConfig,
  type SlackConfig,
  validateSlackConfig,
} from "../plugins/slack/config";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { slackIntegrationSchema } from "./response";
import { createSlackBody, updateSlackBody } from "./schema";

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
  const config = normalizeSlackConfig(
    JSON.parse(integration.config) as SlackConfig,
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    channelName: config.channelName ?? null,
    webhookConfigured: Boolean(config.webhookUrl),
    maskedWebhookUrl: maskWebhookUrl(config.webhookUrl),
    events: {
      ...defaultSlackEvents,
      ...(config.events ?? {}),
    },
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

async function getSlackIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "slack"),
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

const getSlackIntegrationRoute = createRoute({
  method: "get",
  operationId: "getSlackIntegration",
  path: "/project/{projectId}",
  tags: ["Slack"],
  summary: "Get Slack integration",
  description:
    "Get the Slack integration for a project, or null when none is configured.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Slack integration details, or null",
      slackIntegrationSchema.nullable(),
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createSlackIntegrationRoute = createRoute({
  method: "post",
  operationId: "createSlackIntegration",
  path: "/project/{projectId}",
  tags: ["Slack"],
  summary: "Create Slack integration",
  description:
    "Create or replace the Slack integration for a project. The webhook URL is checked for shape only; delivery failures surface later.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createSlackBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The stored integration",
      slackIntegrationSchema.nullable(),
    ),
    400: errorResponse("The webhook URL failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const updateSlackIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateSlackIntegration",
  path: "/project/{projectId}",
  tags: ["Slack"],
  summary: "Update Slack integration",
  description:
    "Update the Slack integration. Omitted fields keep their current value, and event toggles are merged into the existing set.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateSlackBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The updated integration",
      slackIntegrationSchema.nullable(),
    ),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: errorResponse("Slack integration not found"),
  },
});

const deleteSlackIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteSlackIntegration",
  path: "/project/{projectId}",
  tags: ["Slack"],
  summary: "Delete Slack integration",
  description: "Remove the Slack integration from a project.",
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
    404: errorResponse("Slack integration not found"),
  },
});

const slackIntegration = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getSlackIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const integration = await getSlackIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(createSlackIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const config = normalizeSlackConfig({
      webhookUrl: body.webhookUrl,
      channelName: body.channelName,
      events: body.events,
    });

    const validation = await validateSlackConfig(config);
    if (!validation.valid) {
      throw new HTTPException(400, {
        message: validation.errors?.join(", ") ?? "Invalid config",
      });
    }

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "slack"),
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
        type: "slack",
        config: JSON.stringify(config),
        isActive: true,
      });
    }

    const integration = await getSlackIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(updateSlackIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "slack"),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, {
        message: "Slack integration not found",
      });
    }

    const currentConfig = normalizeSlackConfig(
      JSON.parse(existing.config) as SlackConfig,
    );
    const nextConfig = normalizeSlackConfig({
      webhookUrl: body.webhookUrl?.trim() || currentConfig.webhookUrl,
      channelName:
        body.channelName === undefined
          ? currentConfig.channelName
          : (body.channelName ?? undefined),
      events: {
        ...(currentConfig.events ?? {}),
        ...(body.events ?? {}),
      },
    });

    const validation = await validateSlackConfig(nextConfig);
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

    const integration = await getSlackIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(deleteSlackIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "slack"),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, {
        message: "Slack integration not found",
      });
    }

    await db
      .delete(integrationTable)
      .where(eq(integrationTable.id, existing.id));
    return c.json({ success: true }, 200);
  });

export default slackIntegration;
