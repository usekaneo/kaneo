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
  type DiscordConfig,
  defaultDiscordEvents,
  normalizeDiscordConfig,
  validateDiscordConfig,
} from "../plugins/discord/config";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { discordIntegrationSchema } from "./response";
import { createDiscordBody, updateDiscordBody } from "./schema";

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
  const config = normalizeDiscordConfig(
    JSON.parse(integration.config) as DiscordConfig,
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    channelName: config.channelName ?? null,
    webhookConfigured: Boolean(config.webhookUrl),
    maskedWebhookUrl: config.webhookUrl
      ? maskWebhookUrl(config.webhookUrl)
      : "",
    events: {
      ...defaultDiscordEvents,
      ...(config.events ?? {}),
    },
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

async function getDiscordIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "discord"),
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

const getDiscordIntegrationRoute = createRoute({
  method: "get",
  operationId: "getDiscordIntegration",
  path: "/project/{projectId}",
  tags: ["Discord"],
  summary: "Get Discord integration",
  description:
    "Get the Discord integration for a project, or null when none is configured.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Discord integration details, or null",
      discordIntegrationSchema.nullable(),
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createDiscordIntegrationRoute = createRoute({
  method: "post",
  operationId: "createDiscordIntegration",
  path: "/project/{projectId}",
  tags: ["Discord"],
  summary: "Create Discord integration",
  description:
    "Create or replace the Discord integration for a project. The webhook URL is checked for shape only; delivery failures surface later.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createDiscordBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The stored integration",
      discordIntegrationSchema.nullable(),
    ),
    400: errorResponse("The webhook URL failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const updateDiscordIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateDiscordIntegration",
  path: "/project/{projectId}",
  tags: ["Discord"],
  summary: "Update Discord integration",
  description:
    "Update the Discord integration. Omitted fields keep their current value, and event toggles are merged into the existing set.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateDiscordBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The updated integration",
      discordIntegrationSchema.nullable(),
    ),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: errorResponse("Discord integration not found"),
  },
});

const deleteDiscordIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteDiscordIntegration",
  path: "/project/{projectId}",
  tags: ["Discord"],
  summary: "Delete Discord integration",
  description: "Remove the Discord integration from a project.",
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
    404: errorResponse("Discord integration not found"),
  },
});

const discordIntegration = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getDiscordIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const integration = await getDiscordIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(createDiscordIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const config = normalizeDiscordConfig({
      webhookUrl: body.webhookUrl,
      channelName: body.channelName,
      events: body.events,
    });

    const validation = await validateDiscordConfig(config);
    if (!validation.valid) {
      throw new HTTPException(400, {
        message: validation.errors?.join(", ") ?? "Invalid config",
      });
    }

    await db
      .insert(integrationTable)
      .values({
        projectId,
        type: "discord",
        config: JSON.stringify(config),
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [integrationTable.projectId, integrationTable.type],
        set: {
          config: JSON.stringify(config),
          isActive: true,
          updatedAt: new Date(),
        },
      });

    const integration = await getDiscordIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(updateDiscordIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "discord"),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, {
        message: "Discord integration not found",
      });
    }

    const currentConfig = normalizeDiscordConfig(
      JSON.parse(existing.config) as DiscordConfig,
    );
    const nextConfig = normalizeDiscordConfig({
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

    const validation = await validateDiscordConfig(nextConfig);
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

    const integration = await getDiscordIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(deleteDiscordIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "discord"),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, {
        message: "Discord integration not found",
      });
    }

    await db
      .delete(integrationTable)
      .where(eq(integrationTable.id, existing.id));
    return c.json({ success: true }, 200);
  });

export default discordIntegration;
