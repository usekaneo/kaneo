import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { notificationPreferenceSchema } from "../schemas";
import {
  deleteWorkspaceRule,
  getNotificationPreferences,
  updateNotificationPreferences,
  upsertWorkspaceRule,
} from "./service";

const httpErrorSchema = v.object({ message: v.string() });

const workspaceRuleSchema = v.object({
  isActive: v.boolean(),
  emailEnabled: v.boolean(),
  ntfyEnabled: v.boolean(),
  gotifyEnabled: v.boolean(),
  webhookEnabled: v.boolean(),
  projectMode: v.picklist(["all", "selected"] as const),
  selectedProjectIds: v.optional(v.array(v.string())),
});

const notificationPreferences = new Hono<{
  Variables: {
    userId: string;
    userEmail: string;
  };
}>();

notificationPreferences
  .get(
    "/",
    describeRoute({
      operationId: "getNotificationPreferences",
      tags: ["Notification Preferences"],
      description: "Get notification delivery preferences for the current user",
      responses: {
        200: {
          description: "Notification preferences",
          content: {
            "application/json": {
              schema: resolver(notificationPreferenceSchema),
            },
          },
        },
        400: {
          description: "Validation error",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
        403: {
          description: "Forbidden",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
      },
    }),
    async (c) => {
      const userId = c.get("userId");
      const userEmail = c.get("userEmail");
      return c.json(
        await getNotificationPreferences(userId, userEmail || null),
      );
    },
  )
  .put(
    "/",
    describeRoute({
      operationId: "updateNotificationPreferences",
      tags: ["Notification Preferences"],
      description: "Update global notification delivery preferences",
      responses: {
        200: {
          description: "Updated notification preferences",
          content: {
            "application/json": {
              schema: resolver(notificationPreferenceSchema),
            },
          },
        },
        400: {
          description: "Validation error",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
        403: {
          description: "Forbidden",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        emailEnabled: v.optional(v.boolean()),
        ntfyEnabled: v.optional(v.boolean()),
        ntfyServerUrl: v.optional(v.nullable(v.string())),
        ntfyTopic: v.optional(v.nullable(v.string())),
        ntfyToken: v.optional(v.nullable(v.string())),
        gotifyEnabled: v.optional(v.boolean()),
        gotifyServerUrl: v.optional(v.nullable(v.string())),
        gotifyToken: v.optional(v.nullable(v.string())),
        webhookEnabled: v.optional(v.boolean()),
        webhookUrl: v.optional(v.nullable(v.string())),
        webhookSecret: v.optional(v.nullable(v.string())),
      }),
    ),
    async (c) => {
      const userId = c.get("userId");
      const userEmail = c.get("userEmail");
      const body = c.req.valid("json");

      return c.json(
        await updateNotificationPreferences(userId, userEmail || null, body),
      );
    },
  )
  .put(
    "/workspaces/:workspaceId",
    describeRoute({
      operationId: "upsertNotificationPreferenceWorkspaceRule",
      tags: ["Notification Preferences"],
      description: "Create or update a workspace notification rule",
      responses: {
        200: {
          description: "Updated notification preferences",
          content: {
            "application/json": {
              schema: resolver(notificationPreferenceSchema),
            },
          },
        },
        400: {
          description: "Validation error",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
        403: {
          description: "Forbidden",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    validator("json", workspaceRuleSchema),
    async (c) => {
      const userId = c.get("userId");
      const userEmail = c.get("userEmail");
      const { workspaceId } = c.req.valid("param");
      const body = c.req.valid("json");

      return c.json(
        await upsertWorkspaceRule(userId, workspaceId, userEmail || null, body),
      );
    },
  )
  .delete(
    "/workspaces/:workspaceId",
    describeRoute({
      operationId: "deleteNotificationPreferenceWorkspaceRule",
      tags: ["Notification Preferences"],
      description: "Delete a workspace notification rule",
      responses: {
        200: {
          description: "Updated notification preferences",
          content: {
            "application/json": {
              schema: resolver(notificationPreferenceSchema),
            },
          },
        },
        400: {
          description: "Validation error",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
        401: {
          description: "Unauthorized",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
        403: {
          description: "Forbidden",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
        404: {
          description: "Workspace rule not found",
          content: {
            "application/json": { schema: resolver(httpErrorSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    async (c) => {
      const userId = c.get("userId");
      const userEmail = c.get("userEmail");
      const { workspaceId } = c.req.valid("param");

      return c.json(
        await deleteWorkspaceRule(userId, workspaceId, userEmail || null),
      );
    },
  );

export default notificationPreferences;
