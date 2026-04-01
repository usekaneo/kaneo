import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { integrationTable } from "../database/schema";
import { publishEvent } from "../events";
import {
  normalizeTelegramConfig,
  telegramEventsSchema,
  validateTelegramConfig,
} from "../plugins/telegram/config";
import { telegramIntegrationSchema } from "../schemas";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  buildNextTelegramConfigFromPatch,
  getTelegramIntegration,
  parseTelegramIntegrationConfig,
  telegramIntegrationPatchBodySchema,
  toResponse,
} from "./controllers/telegram-controller";

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

const telegramIntegration = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
    apiKey?: {
      id: string;
      userId: string;
      enabled: boolean;
    };
  };
}>();

telegramIntegration
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "getTelegramIntegration",
      tags: ["Telegram"],
      description: "Get Telegram integration for a project",
      responses: {
        200: {
          description: "Telegram integration details",
          content: {
            "application/json": { schema: resolver(telegramIntegrationSchema) },
          },
        },
        404: {
          description: "Telegram integration not found",
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const integration = await getTelegramIntegration(projectId);
      return c.json(integration);
    },
  )
  .post(
    "/project/:projectId",
    describeRoute({
      operationId: "createTelegramIntegration",
      tags: ["Telegram"],
      description: "Create or replace a Telegram integration for a project",
      responses: {
        200: {
          description: "Telegram integration created successfully",
          content: {
            "application/json": { schema: resolver(telegramIntegrationSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        botToken: v.pipe(v.string(), v.minLength(1)),
        chatId: v.pipe(v.string(), v.minLength(1)),
        threadId: v.optional(v.number()),
        chatLabel: v.optional(v.string()),
        events: v.optional(telegramEventsSchema),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const body = c.req.valid("json");

      const config = normalizeTelegramConfig({
        botToken: body.botToken,
        chatId: body.chatId,
        threadId: body.threadId,
        chatLabel: body.chatLabel,
        events: body.events,
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

      return c.json(integration);
    },
  )
  .patch(
    "/project/:projectId",
    describeRoute({
      operationId: "updateTelegramIntegration",
      tags: ["Telegram"],
      description: "Update Telegram integration settings",
      responses: {
        200: {
          description: "Telegram integration updated successfully",
          content: {
            "application/json": { schema: resolver(telegramIntegrationSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator("json", telegramIntegrationPatchBodySchema),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
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
        body.isActive !== undefined
          ? body.isActive
          : (existing.isActive ?? true);

      if (
        JSON.stringify(currentConfig) === JSON.stringify(nextConfig) &&
        resolvedIsActive === (existing.isActive ?? true)
      ) {
        return c.json(toResponse(existing));
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

      return c.json(integration);
    },
  )
  .delete(
    "/project/:projectId",
    describeRoute({
      operationId: "deleteTelegramIntegration",
      tags: ["Telegram"],
      description: "Delete Telegram integration for a project",
      responses: {
        200: {
          description: "Telegram integration deleted successfully",
          content: {
            "application/json": {
              schema: resolver(v.object({ success: v.boolean() })),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
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

      return c.json({ success: true });
    },
  );

export default telegramIntegration;
