import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { notificationPreferenceSchema } from "./response";
import {
  updatePreferencesBody,
  upsertWorkspaceRuleBody,
  workspaceIdParam,
} from "./schema";
import {
  deleteWorkspaceRule,
  getNotificationPreferences,
  updateNotificationPreferences,
  upsertWorkspaceRule,
} from "./service";

const preferencesResponse = (description: string) =>
  jsonResponse(description, notificationPreferenceSchema);

const getPreferencesRoute = createRoute({
  method: "get",
  operationId: "getNotificationPreferences",
  path: "/",
  tags: ["Notification Preferences"],
  summary: "Get notification preferences",
  description:
    "Get how the current user is notified, globally and per workspace. Configured secrets are reported as booleans plus a masked preview, never in full.",
  responses: {
    200: preferencesResponse("Notification preferences"),
  },
});

const updatePreferencesRoute = createRoute({
  method: "put",
  operationId: "updateNotificationPreferences",
  path: "/",
  tags: ["Notification Preferences"],
  summary: "Update notification preferences",
  description:
    "Update the global delivery settings. Omitted fields are left unchanged; a secret sent as null is cleared.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: updatePreferencesBody } },
    },
  },
  responses: {
    200: preferencesResponse("The updated preferences"),
    400: errorResponse("Invalid request"),
  },
});

const upsertWorkspaceRuleRoute = createRoute({
  method: "put",
  operationId: "upsertNotificationPreferenceWorkspaceRule",
  path: "/workspaces/{workspaceId}",
  tags: ["Notification Preferences"],
  summary: "Upsert workspace rule",
  description:
    "Create or replace the notification rule for one workspace, overriding the global settings there.",
  request: {
    params: workspaceIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: upsertWorkspaceRuleBody } },
    },
  },
  responses: {
    200: preferencesResponse("The updated preferences"),
    400: errorResponse("Invalid request"),
    403: errorResponse("No access to the workspace"),
  },
});

const deleteWorkspaceRuleRoute = createRoute({
  method: "delete",
  operationId: "deleteNotificationPreferenceWorkspaceRule",
  path: "/workspaces/{workspaceId}",
  tags: ["Notification Preferences"],
  summary: "Delete workspace rule",
  description:
    "Remove a workspace's rule so the workspace falls back to the global settings.",
  request: { params: workspaceIdParam },
  responses: {
    200: preferencesResponse("The updated preferences"),
    403: errorResponse("No access to the workspace"),
    404: errorResponse("Workspace rule not found"),
  },
});

const notificationPreferences = apiRouter()
  .openapi(getPreferencesRoute, async (c) =>
    c.json(
      await getNotificationPreferences(
        c.get("userId"),
        c.get("userEmail") || null,
      ),
      200,
    ),
  )
  .openapi(updatePreferencesRoute, async (c) =>
    c.json(
      await updateNotificationPreferences(
        c.get("userId"),
        c.get("userEmail") || null,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(upsertWorkspaceRuleRoute, async (c) =>
    c.json(
      await upsertWorkspaceRule(
        c.get("userId"),
        c.req.valid("param").workspaceId,
        c.get("userEmail") || null,
        c.req.valid("json"),
      ),
      200,
    ),
  )
  .openapi(deleteWorkspaceRuleRoute, async (c) =>
    c.json(
      await deleteWorkspaceRule(
        c.get("userId"),
        c.req.valid("param").workspaceId,
        c.get("userEmail") || null,
      ),
      200,
    ),
  );

export default notificationPreferences;
