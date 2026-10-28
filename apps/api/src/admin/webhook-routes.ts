import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { adminAuditRequest } from "./audit/admin-audit-request";
import { requireInstancePermission } from "./roles/require-instance-permission";
import { createWebhook } from "./webhooks/create-webhook";
import { deleteWebhook } from "./webhooks/delete-webhook";
import { listWebhookDeliveries } from "./webhooks/list-webhook-deliveries";
import { listWebhooks } from "./webhooks/list-webhooks";
import { rotateWebhookSecret } from "./webhooks/rotate-webhook-secret";
import {
  deliverySchema,
  queuedSchema,
  webhookInput,
  webhookListSchema,
  webhookParam,
  webhookSchema,
  webhookSecretSchema,
} from "./webhooks/schema";
import { testWebhook } from "./webhooks/test-webhook";
import { updateWebhook } from "./webhooks/update-webhook";

const common = {
  tags: ["Admin"],
  middleware: [
    requireUserSession,
    requireInstancePermission("instance:settings"),
  ],
};
const errors = {
  401: errorResponse("Authentication required"),
  403: errorResponse("The caller lacks instance:settings or used an API key"),
  404: errorResponse("Webhook not found"),
};
const body = {
  required: true,
  content: { "application/json": { schema: webhookInput } },
};
const description =
  "Requires the instance:settings instance permission and a user session. API keys are rejected.";
const list = createRoute({
  ...common,
  method: "get",
  path: "/",
  operationId: "listInstanceWebhooks",
  summary: "List instance webhooks",
  description: `Returns configuration without signing secrets. ${description}`,
  responses: {
    ...errors,
    200: jsonResponse("Instance webhooks", webhookListSchema),
  },
});
const create = createRoute({
  ...common,
  method: "post",
  path: "/",
  operationId: "createInstanceWebhook",
  summary: "Create an instance webhook",
  description: `The signing secret is returned once. URLs must resolve to public addresses (HTTPS in production). ${description}`,
  request: { body },
  responses: {
    ...errors,
    201: jsonResponse(
      "Created webhook and one-time secret",
      webhookSecretSchema,
    ),
    400: errorResponse("Invalid URL or categories"),
    409: errorResponse("Set NOTIFICATION_SECRET_ENCRYPTION_KEY first"),
  },
});
const update = createRoute({
  ...common,
  method: "put",
  path: "/{webhookId}",
  operationId: "updateInstanceWebhook",
  summary: "Update an instance webhook",
  description,
  request: { params: webhookParam, body },
  responses: {
    ...errors,
    200: jsonResponse("Updated webhook", webhookSchema),
    400: errorResponse("Invalid URL or categories"),
  },
});
const remove = createRoute({
  ...common,
  method: "delete",
  path: "/{webhookId}",
  operationId: "deleteInstanceWebhook",
  summary: "Delete an instance webhook",
  description,
  request: { params: webhookParam },
  responses: {
    ...errors,
    200: jsonResponse("Deleted webhook id", queuedSchema),
  },
});
const rotate = createRoute({
  ...common,
  method: "post",
  path: "/{webhookId}/rotate-secret",
  operationId: "rotateInstanceWebhookSecret",
  summary: "Rotate a webhook signing secret",
  description: `Returns the new secret once. Queued deliveries use the new secret. ${description}`,
  request: { params: webhookParam },
  responses: {
    ...errors,
    200: jsonResponse("Webhook and one-time secret", webhookSecretSchema),
    409: errorResponse("Set NOTIFICATION_SECRET_ENCRYPTION_KEY first"),
  },
});
const test = createRoute({
  ...common,
  method: "post",
  path: "/{webhookId}/test",
  operationId: "testInstanceWebhook",
  summary: "Queue a test webhook delivery",
  description: `Queues a webhook.test event regardless of selected categories. ${description}`,
  request: { params: webhookParam },
  responses: {
    ...errors,
    202: jsonResponse("Queued delivery id", queuedSchema),
    409: errorResponse("Webhook is disabled"),
  },
});
const history = createRoute({
  ...common,
  method: "get",
  path: "/{webhookId}/deliveries",
  operationId: "listInstanceWebhookDeliveries",
  summary: "List recent webhook deliveries",
  description: `The latest 20 deliveries, without payloads, URLs, secrets or response bodies. ${description}`,
  request: { params: webhookParam },
  responses: {
    ...errors,
    200: jsonResponse("Recent deliveries", z.array(deliverySchema)),
  },
});

export default apiRouter()
  .openapi(list, async (c) => c.json(await listWebhooks(), 200))
  .openapi(create, async (c) =>
    c.json(await createWebhook(c.req.valid("json"), adminAuditRequest(c)), 201),
  )
  .openapi(update, async (c) =>
    c.json(
      await updateWebhook(
        c.req.valid("param").webhookId,
        c.req.valid("json"),
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(remove, async (c) =>
    c.json(
      await deleteWebhook(c.req.valid("param").webhookId, adminAuditRequest(c)),
      200,
    ),
  )
  .openapi(rotate, async (c) =>
    c.json(
      await rotateWebhookSecret(
        c.req.valid("param").webhookId,
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(test, async (c) =>
    c.json(
      await testWebhook(c.req.valid("param").webhookId, adminAuditRequest(c)),
      202,
    ),
  )
  .openapi(history, async (c) =>
    c.json(await listWebhookDeliveries(c.req.valid("param").webhookId), 200),
  );
