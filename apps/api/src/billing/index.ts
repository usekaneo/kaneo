import { constructWebhookEvent } from "creem/webhooks.js";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { workspaceUserTable } from "../database/schema";
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

type Variables = {
  userId: string;
  userEmail: string;
};

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

const billing = new Hono<{ Variables: Variables }>()
  .post("/webhook", async (c) => {
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

    const result = await handleWebhook(event);
    return c.json(result);
  })
  .get(
    "/:workspaceId",
    describeRoute({
      operationId: "getWorkspaceBilling",
      tags: ["Billing"],
      description:
        "Get the billing state and entitlement for a workspace. Returns billingEnabled: false everywhere when billing is not configured.",
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      await validateWorkspaceAccess(c.get("userId"), workspaceId);
      return c.json(await getWorkspaceBilling(workspaceId));
    },
  )
  .post(
    "/:workspaceId/checkout",
    describeRoute({
      operationId: "createBillingCheckout",
      tags: ["Billing"],
      description:
        "Create a Creem checkout session for a workspace plan. Owner/admin only. Returns the checkout URL to redirect the browser to.",
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    validator(
      "json",
      v.object({
        plan: v.picklist(["personal", "team"]),
        interval: v.picklist(["monthly", "annual"]),
      }),
    ),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const { plan, interval } = c.req.valid("json");
      await requireBillingManager(c.get("userId"), workspaceId);

      const result = await createCheckout({
        workspaceId,
        plan,
        interval,
        userEmail: c.get("userEmail") ?? "",
      });
      return c.json(result);
    },
  )
  .post(
    "/:workspaceId/portal",
    describeRoute({
      operationId: "createBillingPortalSession",
      tags: ["Billing"],
      description:
        "Generate a Creem customer portal link for the workspace subscription. Owner/admin only.",
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      await requireBillingManager(c.get("userId"), workspaceId);

      const billingRow = await getOrCreateWorkspaceBilling(workspaceId);
      if (!billingRow.creemCustomerId) {
        throw new HTTPException(400, {
          message: "No billing customer exists for this workspace yet",
        });
      }

      const { portalUrl } = await createCustomerPortalLink(
        billingRow.creemCustomerId,
      );
      return c.json({ portalUrl });
    },
  );

export default billing;
