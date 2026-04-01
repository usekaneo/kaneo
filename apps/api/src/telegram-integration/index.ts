import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { integrationTable } from "../database/schema";
import {
  normalizeTelegramConfig,
  validateTelegramConfig,
} from "../plugins/telegram/config";
import { telegramIntegrationSchema } from "../schemas";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  getTelegramIntegration,
  parseTelegramIntegrationConfig,
} from "./controllers/telegram-controller";

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

const telegramEventsSchema = v.object({
  taskCreated: v.optional(v.boolean()),
  taskStatusChanged: v.optional(v.boolean()),
  taskPriorityChanged: v.optional(v.boolean()),
  taskTitleChanged: v.optional(v.boolean()),
  taskDescriptionChanged: v.optional(v.boolean()),
  taskCommentCreated: v.optional(v.boolean()),
});

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
      if (!integration) {
        throw new HTTPException(404, {
          message: "Telegram integration not found",
        });
      }
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

      const validation = await validateTelegramConfig(config);
      if (!validation.valid) {
        throw new HTTPException(400, {
          message: validation.errors?.join(", ") ?? "Invalid config",
        });
      }

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
            isActive: true,
            updatedAt: new Date(),
          },
        });

      const integration = await getTelegramIntegration(projectId);
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
    validator(
      "json",
      v.object({
        botToken: v.optional(v.string()),
        chatId: v.optional(v.string()),
        threadId: v.optional(v.nullable(v.number())),
        chatLabel: v.optional(v.nullable(v.string())),
        isActive: v.optional(v.boolean()),
        events: v.optional(telegramEventsSchema),
      }),
    ),
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
      const nextBotToken =
        "botToken" in body
          ? (body.botToken?.trim() ?? "")
          : currentConfig.botToken;
      const nextChatId =
        "chatId" in body ? (body.chatId?.trim() ?? "") : currentConfig.chatId;
      const nextConfig = normalizeTelegramConfig({
        botToken: nextBotToken,
        chatId: nextChatId,
        threadId:
          body.threadId === undefined
            ? currentConfig.threadId
            : (body.threadId ?? undefined),
        chatLabel:
          body.chatLabel === undefined
            ? currentConfig.chatLabel
            : (body.chatLabel ?? undefined),
        events: {
          ...(currentConfig.events ?? {}),
          ...(body.events ?? {}),
        },
      });

      const validation = await validateTelegramConfig(nextConfig);
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

      const integration = await getTelegramIntegration(projectId);
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
      return c.json({ success: true });
    },
  );

export default telegramIntegration;
