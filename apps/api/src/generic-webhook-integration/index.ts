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
  defaultGenericWebhookEvents,
  type GenericWebhookConfig,
  normalizeGenericWebhookConfig,
  validateGenericWebhookConfig,
} from "../plugins/generic-webhook/config";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { genericWebhookIntegrationSchema } from "./response";
import { createWebhookBody, updateWebhookBody } from "./schema";

function maskValue(value: string | undefined): string | null {
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
    maskedWebhookUrl: maskValue(config.webhookUrl),
    secretConfigured: Boolean(config.secret),
    maskedSecret: maskValue(config.secret),
    events: {
      ...defaultGenericWebhookEvents,
      ...(config.events ?? {}),
    },
    dueDateReminderLeadTimeMinutes:
      config.dueDateReminderLeadTimeMinutes ?? 1440,
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

const manageAccess = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];

const getGenericWebhookIntegrationRoute = createRoute({
  method: "get",
  operationId: "getGenericWebhookIntegration",
  path: "/project/{projectId}",
  tags: ["Generic Webhook"],
  summary: "Get webhook integration",
  description:
    "Get the outgoing webhook integration for a project, or null when none is configured.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Webhook integration details, or null",
      genericWebhookIntegrationSchema.nullable(),
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createGenericWebhookIntegrationRoute = createRoute({
  method: "post",
  operationId: "createGenericWebhookIntegration",
  path: "/project/{projectId}",
  tags: ["Generic Webhook"],
  summary: "Create webhook integration",
  description:
    "Create or replace the outgoing webhook for a project. Kaneo POSTs the selected task events to this URL, signed with the secret when one is set.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createWebhookBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The stored integration",
      genericWebhookIntegrationSchema.nullable(),
    ),
    400: errorResponse("The webhook URL failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const updateGenericWebhookIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateGenericWebhookIntegration",
  path: "/project/{projectId}",
  tags: ["Generic Webhook"],
  summary: "Update webhook integration",
  description:
    "Update the outgoing webhook. Omitted fields keep their current value, event toggles merge into the existing set, and a null secret clears it.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateWebhookBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The updated integration",
      genericWebhookIntegrationSchema.nullable(),
    ),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: errorResponse("Webhook integration not found"),
  },
});

const deleteGenericWebhookIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteGenericWebhookIntegration",
  path: "/project/{projectId}",
  tags: ["Generic Webhook"],
  summary: "Delete webhook integration",
  description: "Remove the outgoing webhook from a project.",
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
    404: errorResponse("Webhook integration not found"),
  },
});

const genericWebhookIntegration = apiRouter<
  BaseVariables & { workspaceId: string }
>()
  .openapi(getGenericWebhookIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json(await getGenericWebhookIntegration(projectId), 200);
  })
  .openapi(createGenericWebhookIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const config = normalizeGenericWebhookConfig({
      webhookUrl: body.webhookUrl,
      secret: body.secret,
      events: body.events,
      dueDateReminderLeadTimeMinutes: body.dueDateReminderLeadTimeMinutes,
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

    return c.json(await getGenericWebhookIntegration(projectId), 200);
  })
  .openapi(updateGenericWebhookIntegrationRoute, async (c) => {
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
      dueDateReminderLeadTimeMinutes:
        body.dueDateReminderLeadTimeMinutes ??
        currentConfig.dueDateReminderLeadTimeMinutes,
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

    return c.json(await getGenericWebhookIntegration(projectId), 200);
  })
  .openapi(deleteGenericWebhookIntegrationRoute, async (c) => {
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

    return c.json({ success: true }, 200);
  });

export default genericWebhookIntegration;
