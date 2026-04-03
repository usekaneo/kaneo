import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { integrationTable } from "../database/schema";
import {
  type DiscordConfig,
  defaultDiscordEvents,
  normalizeDiscordConfig,
  validateDiscordConfig,
} from "../plugins/discord/config";
import { discordIntegrationSchema } from "../schemas";
import { workspaceAccess } from "../utils/workspace-access-middleware";

const discordIntegration = new Hono<{
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

const discordEventsSchema = v.object({
  taskCreated: v.optional(v.boolean()),
  taskStatusChanged: v.optional(v.boolean()),
  taskPriorityChanged: v.optional(v.boolean()),
  taskTitleChanged: v.optional(v.boolean()),
  taskDescriptionChanged: v.optional(v.boolean()),
  taskCommentCreated: v.optional(v.boolean()),
});

const nullableDiscordIntegrationSchema = v.nullable(discordIntegrationSchema);

discordIntegration
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "getDiscordIntegration",
      tags: ["Discord"],
      description: "Get Discord integration for a project",
      responses: {
        200: {
          description: "Discord integration details",
          content: {
            "application/json": {
              schema: resolver(nullableDiscordIntegrationSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const integration = await getDiscordIntegration(projectId);
      return c.json(integration);
    },
  )
  .post(
    "/project/:projectId",
    describeRoute({
      operationId: "createDiscordIntegration",
      tags: ["Discord"],
      description: "Create or replace a Discord integration for a project",
      responses: {
        200: {
          description: "Discord integration created successfully",
          content: {
            "application/json": {
              schema: resolver(discordIntegrationSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        webhookUrl: v.pipe(v.string(), v.minLength(1)),
        channelName: v.optional(v.string()),
        events: v.optional(discordEventsSchema),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
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
      return c.json(integration);
    },
  )
  .patch(
    "/project/:projectId",
    describeRoute({
      operationId: "updateDiscordIntegration",
      tags: ["Discord"],
      description: "Update Discord integration settings",
      responses: {
        200: {
          description: "Discord integration updated successfully",
          content: {
            "application/json": { schema: resolver(discordIntegrationSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        webhookUrl: v.optional(v.string()),
        channelName: v.optional(v.nullable(v.string())),
        isActive: v.optional(v.boolean()),
        events: v.optional(discordEventsSchema),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
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
      return c.json(integration);
    },
  )
  .delete(
    "/project/:projectId",
    describeRoute({
      operationId: "deleteDiscordIntegration",
      tags: ["Discord"],
      description: "Delete Discord integration for a project",
      responses: {
        200: {
          description: "Discord integration deleted successfully",
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
      return c.json({ success: true });
    },
  );

export default discordIntegration;
