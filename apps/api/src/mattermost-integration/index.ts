import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { integrationTable } from "../database/schema";
import {
  defaultMattermostEvents,
  type MattermostConfig,
  normalizeMattermostConfig,
  validateMattermostConfig,
} from "../plugins/mattermost/config";
import { mattermostIntegrationSchema } from "../schemas";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";

const mattermostIntegration = new Hono<{
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

const nullableMattermostIntegrationSchema = v.nullable(
  mattermostIntegrationSchema,
);

mattermostIntegration
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "getMattermostIntegration",
      tags: ["Mattermost"],
      description: "Get Mattermost integration for a project",
      responses: {
        200: {
          description: "Mattermost integration details",
          content: {
            "application/json": {
              schema: resolver(nullableMattermostIntegrationSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const integration = await getMattermostIntegration(projectId);
      return c.json(integration);
    },
  )
  .post(
    "/project/:projectId",
    describeRoute({
      operationId: "createMattermostIntegration",
      tags: ["Mattermost"],
      description: "Create or replace a Mattermost integration for a project",
      responses: {
        200: {
          description: "Mattermost integration created successfully",
          content: {
            "application/json": {
              schema: resolver(mattermostIntegrationSchema),
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
        events: v.optional(
          v.object({
            taskCreated: v.optional(v.boolean()),
            taskStatusChanged: v.optional(v.boolean()),
            taskPriorityChanged: v.optional(v.boolean()),
            taskTitleChanged: v.optional(v.boolean()),
            taskDescriptionChanged: v.optional(v.boolean()),
            taskCommentCreated: v.optional(v.boolean()),
          }),
        ),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
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
      return c.json(integration);
    },
  )
  .patch(
    "/project/:projectId",
    describeRoute({
      operationId: "updateMattermostIntegration",
      tags: ["Mattermost"],
      description: "Update Mattermost integration settings",
      responses: {
        200: {
          description: "Mattermost integration updated successfully",
          content: {
            "application/json": {
              schema: resolver(mattermostIntegrationSchema),
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
        channelName: v.optional(v.nullable(v.string())),
        isActive: v.optional(v.boolean()),
        events: v.optional(
          v.object({
            taskCreated: v.optional(v.boolean()),
            taskStatusChanged: v.optional(v.boolean()),
            taskPriorityChanged: v.optional(v.boolean()),
            taskTitleChanged: v.optional(v.boolean()),
            taskDescriptionChanged: v.optional(v.boolean()),
            taskCommentCreated: v.optional(v.boolean()),
          }),
        ),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
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
      return c.json(integration);
    },
  )
  .delete(
    "/project/:projectId",
    describeRoute({
      operationId: "deleteMattermostIntegration",
      tags: ["Mattermost"],
      description: "Delete Mattermost integration for a project",
      responses: {
        200: {
          description: "Mattermost integration deleted successfully",
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
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
    async (c) => {
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
      return c.json({ success: true });
    },
  );

export default mattermostIntegration;
