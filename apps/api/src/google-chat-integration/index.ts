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
  defaultGoogleChatEvents,
  type GoogleChatConfig,
  normalizeGoogleChatConfig,
  validateGoogleChatConfig,
} from "../plugins/google-chat/config";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { googleChatIntegrationSchema } from "./response";
import { createGoogleChatBody, updateGoogleChatBody } from "./schema";

function maskWebhookUrl(value: string): string {
  try {
    const url = new URL(value);
    const spaceId = url.pathname.split("/")[3] ?? "";
    const maskedSpace =
      spaceId.length > 8
        ? `${spaceId.slice(0, 4)}…${spaceId.slice(-4)}`
        : "••••";
    return `${url.origin}/v1/spaces/${maskedSpace}/messages?key=••••&token=••••`;
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
  const config = normalizeGoogleChatConfig(
    JSON.parse(integration.config) as GoogleChatConfig,
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    channelName: config.channelName ?? null,
    webhookConfigured: Boolean(config.webhookUrl),
    maskedWebhookUrl: maskWebhookUrl(config.webhookUrl),
    events: {
      ...defaultGoogleChatEvents,
      ...(config.events ?? {}),
    },
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

async function getGoogleChatIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "google-chat"),
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

const getGoogleChatIntegrationRoute = createRoute({
  method: "get",
  operationId: "getGoogleChatIntegration",
  path: "/project/{projectId}",
  tags: ["Google Chat"],
  summary: "Get Google Chat integration",
  description:
    "Get the Google Chat integration for a project, or null when none is configured.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Google Chat integration details, or null",
      googleChatIntegrationSchema.nullable(),
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createGoogleChatIntegrationRoute = createRoute({
  method: "post",
  operationId: "createGoogleChatIntegration",
  path: "/project/{projectId}",
  tags: ["Google Chat"],
  summary: "Create Google Chat integration",
  description:
    "Create or replace the Google Chat integration for a project. The webhook URL is checked for shape only; delivery failures surface later.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createGoogleChatBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The stored integration",
      googleChatIntegrationSchema.nullable(),
    ),
    400: errorResponse("The webhook URL failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
  },
});

const updateGoogleChatIntegrationRoute = createRoute({
  method: "patch",
  operationId: "updateGoogleChatIntegration",
  path: "/project/{projectId}",
  tags: ["Google Chat"],
  summary: "Update Google Chat integration",
  description:
    "Update the Google Chat integration. Omitted fields keep their current value, and event toggles are merged into the existing set.",
  middleware: manageAccess,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateGoogleChatBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The updated integration",
      googleChatIntegrationSchema.nullable(),
    ),
    400: errorResponse("The resulting config failed validation"),
    403: errorResponse(
      "No workspace access, or missing workspace:manage_settings",
    ),
    404: errorResponse("Google Chat integration not found"),
  },
});

const deleteGoogleChatIntegrationRoute = createRoute({
  method: "delete",
  operationId: "deleteGoogleChatIntegration",
  path: "/project/{projectId}",
  tags: ["Google Chat"],
  summary: "Delete Google Chat integration",
  description: "Remove the Google Chat integration from a project.",
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
    404: errorResponse("Google Chat integration not found"),
  },
});

const googleChatIntegration = apiRouter<
  BaseVariables & { workspaceId: string }
>()
  .openapi(getGoogleChatIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const integration = await getGoogleChatIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(createGoogleChatIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const config = normalizeGoogleChatConfig({
      webhookUrl: body.webhookUrl,
      channelName: body.channelName,
      events: body.events,
    });

    const validation = await validateGoogleChatConfig(config);
    if (!validation.valid) {
      throw new HTTPException(400, {
        message: validation.errors?.join(", ") ?? "Invalid config",
      });
    }

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "google-chat"),
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
        type: "google-chat",
        config: JSON.stringify(config),
        isActive: true,
      });
    }

    const integration = await getGoogleChatIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(updateGoogleChatIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "google-chat"),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, {
        message: "Google Chat integration not found",
      });
    }

    const currentConfig = normalizeGoogleChatConfig(
      JSON.parse(existing.config) as GoogleChatConfig,
    );
    const nextConfig = normalizeGoogleChatConfig({
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

    const validation = await validateGoogleChatConfig(nextConfig);
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

    const integration = await getGoogleChatIntegration(projectId);
    return c.json(integration, 200);
  })
  .openapi(deleteGoogleChatIntegrationRoute, async (c) => {
    const { projectId } = c.req.valid("param");

    const existing = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "google-chat"),
      ),
    });

    if (!existing) {
      throw new HTTPException(404, {
        message: "Google Chat integration not found",
      });
    }

    await db
      .delete(integrationTable)
      .where(eq(integrationTable.id, existing.id));
    return c.json({ success: true }, 200);
  });

export default googleChatIntegration;
