import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { integrationTable } from "../database/schema";
import { publishEvent } from "../events";
import { deletedSchema, projectIdParam } from "../integrations/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import {
  defaultTelegramEvents,
  normalizeTelegramConfig,
  validateTelegramConfig,
} from "../plugins/telegram/config";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  buildNextTelegramConfigFromPatch,
  getTelegramIntegration,
  parseTelegramIntegrationConfig,
  toResponse,
} from "./controllers/telegram-controller";
import { telegramIntegrationSchema } from "./response";
import { createTelegramBody, updateTelegramBody } from "./schema";

function safePublishIntegrationEvent(
  eventName:
    | "integration.created"
    | "integration.updated"
    | "integration.deleted",
  data: {
    projectId: string;
    userId: string;
    integrationType: "telegram";
    integrationId: string;
    apiKeyId?: string;
  },
) {
  void publishEvent(eventName, data).catch((error) => {
    console.error(`Failed to publish ${eventName}:`, error);
  });
}

const manageAccess = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const getTelegramIntegrationRoute = createRoute({
  method: "get",
  operationId: "getTelegramIntegration",
  path: "/project/{projectId}",
  tags: ["Telegram"],
  summary: "Get Telegram integration",
  description:
    "Get the Telegram integration for a project, or null when none is configured.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Telegram integration details, or null",
      telegramIntegrationSchema.nullable(),
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createTelegramIntegrationRoute = createRoute({
  method: "post",
  operationId: "createTelegramIntegration",
  path: "/project/{projectId}",
  tags: ["Telegram"],
  summary: "Create Telegram integration",
  description:
    "Create or replace the Telegram integration for a project. The bot token and chat are checked for shape only, not against Telegram.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createTelegramBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The stored integration",
      telegramIntegrationSchema.nullable(),
    ),
    400: errorResponse("The bot token or chat failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const updateTelegramIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateTelegramIntegration",
  path: "/project/{projectId}",
  tags: ["Telegram"],
  summary: "Update Telegram integration",
  description:
    "Update the Telegram integration. Omitted fields keep their current value; threadId and chatLabel accept null to clear them.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateTelegramBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The updated integration",
      telegramIntegrationSchema.nullable(),
    ),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: errorResponse("Telegram integration not found"),
  },
});

const deleteTelegramIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteTelegramIntegration",
  path: "/project/{projectId}",
  tags: ["Telegram"],
  summary: "Delete Telegram integration",
  description: "Remove the Telegram integration from a project.",
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
    404: errorResponse("Telegram integration not found"),
  },
});

const telegramIntegration = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getTelegramIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const integration = await getTelegramIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(createTelegramIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const config = normalizeTelegramConfig({
      botToken: body.botToken,
      chatId: body.chatId,
      threadId: body.threadId,
      chatLabel: body.chatLabel,
      events: { ...defaultTelegramEvents, ...(body.events ?? {}) },
    });

    const validation = validateTelegramConfig(config);
    if (!validation.valid) {
      throw new HTTPException(400, {
        message: validation.errors?.join(", ") ?? "Invalid config",
      });
    }

    const priorIntegration = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "telegram"),
      ),
      columns: { id: true },
    });

    await db
      .insert(integrationTable)
      .values({
        projectId,
        type: "telegram",
        config: JSON.stringify(config),
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [integrationTable.projectId, integrationTable.type],
        set: {
          config: JSON.stringify(config),
          updatedAt: new Date(),
        },
      });

    const integration = await getTelegramIntegration(projectId);
    if (!integration) {
      throw new HTTPException(500, {
        message: "Failed to load Telegram integration after save",
      });
    }

    const apiKey = c.get("apiKey");
    safePublishIntegrationEvent(
      priorIntegration ? "integration.updated" : "integration.created",
      {
        projectId,
        userId: c.get("userId"),
        integrationType: "telegram",
        integrationId: integration.id,
        ...(apiKey?.id ? { apiKeyId: apiKey.id } : {}),
      },
    );

    return c.json(integration, 200);
  })
  .openapi(updateTelegramIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "telegram"),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, {
        message: "Telegram integration not found",
      });
    }

    const currentConfig = parseTelegramIntegrationConfig(existing);
    const nextConfig = normalizeTelegramConfig(
      buildNextTelegramConfigFromPatch(body, currentConfig),
    );

    const resolvedIsActive =
      body.isActive !== undefined ? body.isActive : (existing.isActive ?? true);

    if (
      JSON.stringify(currentConfig) === JSON.stringify(nextConfig) &&
      resolvedIsActive === (existing.isActive ?? true)
    ) {
      return c.json(toResponse(existing), 200);
    }

    const validation = validateTelegramConfig(nextConfig);
    if (!validation.valid) {
      throw new HTTPException(400, {
        message: validation.errors?.join(", ") ?? "Invalid config",
      });
    }

    await db
      .update(integrationTable)
      .set({
        config: JSON.stringify(nextConfig),
        isActive: resolvedIsActive,
        updatedAt: new Date(),
      })
      .where(eq(integrationTable.id, existing.id));

    const integration = await getTelegramIntegration(projectId);
    if (!integration) {
      throw new HTTPException(500, {
        message: "Failed to load Telegram integration after update",
      });
    }

    const apiKey = c.get("apiKey");
    safePublishIntegrationEvent("integration.updated", {
      projectId,
      userId: c.get("userId"),
      integrationType: "telegram",
      integrationId: integration.id,
      ...(apiKey?.id ? { apiKeyId: apiKey.id } : {}),
    });

    return c.json(integration, 200);
  })
  .openapi(deleteTelegramIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "telegram"),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, {
        message: "Telegram integration not found",
      });
    }

    await db
      .delete(integrationTable)
      .where(eq(integrationTable.id, existing.id));

    const apiKey = c.get("apiKey");
    safePublishIntegrationEvent("integration.deleted", {
      projectId,
      userId: c.get("userId"),
      integrationType: "telegram",
      integrationId: existing.id,
      ...(apiKey?.id ? { apiKeyId: apiKey.id } : {}),
    });

    return c.json({ success: true }, 200);
  });

export default telegramIntegration;
