import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { integrationTable } from "../database/schema";
import {
  defaultGenericWebhookEvents,
  type GenericWebhookConfig,
  normalizeGenericWebhookConfig,
  validateGenericWebhookConfig,
} from "../plugins/generic-webhook/config";
import { genericWebhookIntegrationSchema } from "../schemas";
import { workspaceAccess } from "../utils/workspace-access-middleware";

const genericWebhookIntegration = new Hono<{
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

function maskSecret(value: string | undefined): string | null {
  if (!value) return null;
  return value.length > 8 ? `${value.slice(0, 4)}…${value.slice(-4)}` : "••••";
}

function toResponse(integration: {
  id: string;
  projectId: string;
  config: string;
  isActive: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const config = normalizeGenericWebhookConfig(
    JSON.parse(integration.config) as GenericWebhookConfig,
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    webhookConfigured: Boolean(config.webhookUrl),
    webhookUrl: config.webhookUrl,
    secretConfigured: Boolean(config.secret),
    maskedSecret: maskSecret(config.secret),
    events: {
      ...defaultGenericWebhookEvents,
      ...(config.events ?? {}),
    },
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

async function getGenericWebhookIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "generic-webhook"),
    ),
  });

  if (!integration) {
    return null;
  }

  return toResponse(integration);
}

const genericWebhookEventsSchema = v.object({
  taskCreated: v.optional(v.boolean()),
  taskStatusChanged: v.optional(v.boolean()),
  taskPriorityChanged: v.optional(v.boolean()),
  taskTitleChanged: v.optional(v.boolean()),
  taskDescriptionChanged: v.optional(v.boolean()),
  taskCommentCreated: v.optional(v.boolean()),
});

genericWebhookIntegration
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "getGenericWebhookIntegration",
      tags: ["Generic Webhook"],
      description: "Get generic outgoing webhook integration for a project",
      responses: {
        200: {
          description: "Generic webhook integration details",
          content: {
            "application/json": {
              schema: resolver(genericWebhookIntegrationSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      return c.json(await getGenericWebhookIntegration(projectId));
    },
  )
  .post(
    "/project/:projectId",
    describeRoute({
      operationId: "createGenericWebhookIntegration",
      tags: ["Generic Webhook"],
      description: "Create or replace a generic outgoing webhook integration",
      responses: {
        200: {
          description: "Generic webhook integration created successfully",
          content: {
            "application/json": {
              schema: resolver(genericWebhookIntegrationSchema),
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
        secret: v.optional(v.string()),
        events: v.optional(genericWebhookEventsSchema),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const body = c.req.valid("json");

      const config = normalizeGenericWebhookConfig({
        webhookUrl: body.webhookUrl,
        secret: body.secret,
        events: body.events,
      });

      const validation = await validateGenericWebhookConfig(config);
      if (!validation.valid) {
        throw new HTTPException(400, {
          message: validation.errors?.join(", ") ?? "Invalid config",
        });
      }

      const existing = await db.query.integrationTable.findFirst({
        where: and(
          eq(integrationTable.projectId, projectId),
          eq(integrationTable.type, "generic-webhook"),
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
          type: "generic-webhook",
          config: JSON.stringify(config),
          isActive: true,
        });
      }

      return c.json(await getGenericWebhookIntegration(projectId));
    },
  )
  .patch(
    "/project/:projectId",
    describeRoute({
      operationId: "updateGenericWebhookIntegration",
      tags: ["Generic Webhook"],
      description: "Update generic outgoing webhook settings",
      responses: {
        200: {
          description: "Generic webhook integration updated successfully",
          content: {
            "application/json": {
              schema: resolver(genericWebhookIntegrationSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        webhookUrl: v.optional(v.string()),
        secret: v.optional(v.nullable(v.string())),
        isActive: v.optional(v.boolean()),
        events: v.optional(genericWebhookEventsSchema),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const body = c.req.valid("json");

      const existing = await db.query.integrationTable.findFirst({
        where: and(
          eq(integrationTable.projectId, projectId),
          eq(integrationTable.type, "generic-webhook"),
        ),
      });

      if (!existing) {
        throw new HTTPException(404, {
          message: "Generic webhook integration not found",
        });
      }

      const currentConfig = normalizeGenericWebhookConfig(
        JSON.parse(existing.config) as GenericWebhookConfig,
      );
      const nextConfig = normalizeGenericWebhookConfig({
        webhookUrl: body.webhookUrl?.trim() || currentConfig.webhookUrl,
        secret:
          body.secret === undefined
            ? currentConfig.secret
            : (body.secret ?? undefined),
        events: {
          ...(currentConfig.events ?? {}),
          ...(body.events ?? {}),
        },
      });

      const validation = await validateGenericWebhookConfig(nextConfig);
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

      return c.json(await getGenericWebhookIntegration(projectId));
    },
  )
  .delete(
    "/project/:projectId",
    describeRoute({
      operationId: "deleteGenericWebhookIntegration",
      tags: ["Generic Webhook"],
      description: "Delete generic outgoing webhook integration for a project",
      responses: {
        200: {
          description: "Generic webhook integration deleted successfully",
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
          eq(integrationTable.type, "generic-webhook"),
        ),
      });

      if (!existing) {
        throw new HTTPException(404, {
          message: "Generic webhook integration not found",
        });
      }

      await db
        .delete(integrationTable)
        .where(eq(integrationTable.id, existing.id));

      return c.json({ success: true });
    },
  );

export default genericWebhookIntegration;
