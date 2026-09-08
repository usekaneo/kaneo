import { constructWebhookEvent } from "creem/webhooks.js";
import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { workspaceUserTable } from "../database/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { validateWorkspaceAccess } from "../utils/validate-workspace-access";
import { creemWebhookSecret, isBillingEnabled } from "./config";
import createCheckout from "./controllers/create-checkout";
import getWorkspaceBilling, {
  getOrCreateWorkspaceBilling,
} from "./controllers/get-workspace-billing";
import handleWebhook, {
  type BillingWebhookEvent,
} from "./controllers/handle-webhook";
import { createCustomerPortalLink } from "./creem-client";
import {
  checkoutSchema,
  portalSchema,
  webhookResultSchema,
  workspaceBillingSchema,
} from "./response";
import { createCheckoutBody, workspaceIdParam } from "./schema";

async function requireBillingManager(userId: string, workspaceId: string) {
  await validateWorkspaceAccess(userId, workspaceId);

  const [member] = await db
    .select({ role: workspaceUserTable.role })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
        inArray(workspaceUserTable.role, ["owner", "admin"]),
      ),
    );

  if (!member) {
    throw new HTTPException(403, {
      message: "Only workspace owners and admins can manage billing",
    });
  }
}

// Excluded from the app-wide auth middleware: authenticity comes from the
// provider's webhook signature instead of a session.
// Kaneo Cloud only: still served, but kept out of the published document so the
// self-hosted API reference does not advertise a paid tier that does not exist.
const cloudOnly = { hide: true } as const;

const webhookRoute = createRoute({
  ...cloudOnly,
  method: "post",
  operationId: "handleBillingWebhook",
  path: "/webhook",
  tags: ["Billing"],
  summary: "Billing webhook",
  description:
    "Receive a Creem subscription event. Authenticated by signature, not by session, and idempotent per event id.",
  security: [],
  responses: {
    200: jsonResponse("The event was accepted", webhookResultSchema),
    400: errorResponse("Signature verification failed"),
    404: errorResponse("Billing is not enabled on this instance"),
  },
});

const getWorkspaceBillingRoute = createRoute({
  ...cloudOnly,
  method: "get",
  operationId: "getWorkspaceBilling",
  path: "/{workspaceId}",
  tags: ["Billing"],
  summary: "Get workspace billing",
  description:
    "Get the billing state and entitlement for a workspace. When the instance has no billing configured this reports billingEnabled: false and an always-active entitlement.",
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse(
      "Billing state for the workspace",
      workspaceBillingSchema,
    ),
    403: errorResponse("No access to the workspace"),
  },
});

const createCheckoutRoute = createRoute({
  ...cloudOnly,
  method: "post",
  operationId: "createBillingCheckout",
  path: "/{workspaceId}/checkout",
  tags: ["Billing"],
  summary: "Create checkout",
  description:
    "Create a Creem checkout session for a workspace plan and return the URL to redirect the browser to. Workspace owners and admins only.",
  request: {
    params: workspaceIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createCheckoutBody } },
    },
  },
  responses: {
    200: jsonResponse("The checkout session", checkoutSchema),
    400: errorResponse("Invalid plan or interval"),
    403: errorResponse("Not a workspace owner or admin"),
  },
});

const createPortalRoute = createRoute({
  ...cloudOnly,
  method: "post",
  operationId: "createBillingPortalSession",
  path: "/{workspaceId}/portal",
  tags: ["Billing"],
  summary: "Create portal session",
  description:
    "Generate a Creem customer portal link for the workspace subscription. Workspace owners and admins only, and only once a billing customer exists.",
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("The portal link", portalSchema),
    400: errorResponse("No billing customer exists for this workspace yet"),
    403: errorResponse("Not a workspace owner or admin"),
  },
});

const billing = apiRouter<BaseVariables>()
  .openapi(webhookRoute, async (c) => {
    if (!isBillingEnabled()) {
      throw new HTTPException(404, { message: "Not found" });
    }

    const rawBody = await c.req.text();
    let event: BillingWebhookEvent;
    try {
      const parsed = await constructWebhookEvent(
        rawBody,
        c.req.header(),
        creemWebhookSecret(),
      );
      event = {
        id: parsed.id,
        type: parsed.type,
        data: parsed.data as BillingWebhookEvent["data"],
      };
    } catch (error) {
      console.error("billing: webhook signature verification failed", error);
      throw new HTTPException(400, { message: "Invalid signature" });
    }

    return c.json(await handleWebhook(event), 200);
  })
  .openapi(getWorkspaceBillingRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    await validateWorkspaceAccess(c.get("userId"), workspaceId);
    return c.json(await getWorkspaceBilling(workspaceId), 200);
  })
  .openapi(createCheckoutRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    const { plan, interval } = c.req.valid("json");
    await requireBillingManager(c.get("userId"), workspaceId);

    return c.json(
      await createCheckout({
        workspaceId,
        plan,
        interval,
        userEmail: c.get("userEmail") ?? "",
      }),
      200,
    );
  })
  .openapi(createPortalRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    await requireBillingManager(c.get("userId"), workspaceId);

    const billingRow = await getOrCreateWorkspaceBilling(workspaceId);
    if (!billingRow.creemCustomerId) {
      throw new HTTPException(400, {
        message: "No billing customer exists for this workspace yet",
      });
    }

    return c.json(
      await createCustomerPortalLink(billingRow.creemCustomerId),
      200,
    );
  });

export default billing;
