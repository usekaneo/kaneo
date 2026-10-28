import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { adminAuditRequest } from "./audit/admin-audit-request";
import getAdminSettings from "./controllers/get-admin-settings";
import updateAdminSettings from "./controllers/update-admin-settings";
import { requireInstancePermission } from "./roles/require-instance-permission";
import {
  instanceSettingsSchema,
  updateInstanceSettingsBody,
} from "./settings/schema";

const forbidden = errorResponse(
  "The caller lacks the instance permission or used an API key",
);

const getSettingsRoute = createRoute({
  method: "get",
  operationId: "getInstanceSettings",
  path: "/",
  tags: ["Admin"],
  summary: "Get instance settings",
  description:
    "Read the instance-wide settings, which ones an environment variable locks, and the choices for the default role and integrations. Requires the `instance:settings` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("instance:settings"),
  ] as const,
  responses: {
    200: jsonResponse("Instance settings", instanceSettingsSchema),
    403: forbidden,
  },
});

const updateSettingsRoute = createRoute({
  method: "patch",
  operationId: "updateInstanceSettings",
  path: "/",
  tags: ["Admin"],
  summary: "Update instance settings",
  description:
    "Change one or more instance-wide settings. Other API instances apply a change within a few seconds. Requires the `instance:settings` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("instance:settings"),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: updateInstanceSettingsBody } },
    },
  },
  responses: {
    200: jsonResponse("The saved settings", instanceSettingsSchema),
    400: errorResponse(
      "Invalid value, `admin` as the default role, an unknown role or integration, or email verification without SMTP",
    ),
    403: errorResponse(
      "The caller lacks the instance permission, used an API key, or chose a default role with permissions they lack",
    ),
    409: errorResponse(
      "An environment variable locks the setting (code SETTING_LOCKED_BY_ENV)",
    ),
  },
});

const adminSettingsRoutes = apiRouter()
  .openapi(getSettingsRoute, async (c) => c.json(await getAdminSettings(), 200))
  .openapi(updateSettingsRoute, async (c) =>
    c.json(
      await updateAdminSettings(c.req.valid("json"), adminAuditRequest(c)),
      200,
    ),
  );

export default adminSettingsRoutes;
