import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../../openapi";
import { requireUserSession } from "../../utils/require-user-session";
import { adminAuditRequest } from "../audit/admin-audit-request";
import { requireInstancePermission } from "../roles/require-instance-permission";
import {
  adminAgentSettingsSchema,
  agentModelPolicySchema,
  catalogSchema,
} from "./schema";
import { readAgentSettings } from "./read-settings";
import { updateAgentSettings } from "./update-settings";
import { listModelCatalog } from "./model-catalog";

const middleware = [
  requireUserSession,
  requireInstancePermission("instance:settings"),
];
const errors = {
  403: errorResponse(
    "Instance settings permission required; API keys are rejected",
  ),
};

export const adminAgentRoutes = apiRouter()
  .openapi(
    createRoute({
      method: "get",
      path: "/settings",
      operationId: "getAdminAgentSettings",
      tags: ["Admin"],
      summary:
        "Get the instance's allowed agent models and connected providers",
      middleware,
      responses: {
        200: jsonResponse(
          "Model settings, without credentials",
          adminAgentSettingsSchema,
        ),
        ...errors,
      },
    }),
    async (c) => c.json(await readAgentSettings(), 200),
  )
  .openapi(
    createRoute({
      method: "patch",
      path: "/settings",
      operationId: "updateAdminAgentSettings",
      tags: ["Admin"],
      summary: "Choose the default and allowed agent models",
      description:
        "Instance settings permission is required. Saves a persistent model policy for conversations and automations; null restores environment defaults. Keys remain server-side. Other API instances pick up changes within five seconds.",
      middleware,
      request: {
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z
                .object({ policy: agentModelPolicySchema.nullable() })
                .strict(),
            },
          },
        },
      },
      responses: {
        200: jsonResponse("Saved model settings", adminAgentSettingsSchema),
        400: errorResponse(
          "Invalid model policy or a provider is not configured",
        ),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await updateAgentSettings(
          c.req.valid("json").policy,
          adminAuditRequest(c),
        ),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/models",
      operationId: "listAdminAgentModels",
      tags: ["Admin"],
      summary: "Discover models from a connected provider",
      middleware,
      description:
        "Lists provider-reported models for Anthropic, OpenAI, Google, OpenRouter, or a configured OpenAI-compatible endpoint. Other adapters support manual model IDs. Model listing does not guarantee tool or attachment support.",
      request: {
        query: z.object({
          provider: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
        }),
      },
      responses: {
        200: jsonResponse("Provider model choices", catalogSchema),
        400: errorResponse("Invalid provider name"),
        502: errorResponse("Provider catalog unavailable"),
        ...errors,
      },
    }),
    async (c) =>
      c.json(await listModelCatalog(c.req.valid("query").provider), 200),
  );
