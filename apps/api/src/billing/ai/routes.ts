import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../../openapi";
import { workspaceAccessMiddleware } from "../../utils/workspace-access-middleware";
import { requireUserSession } from "../../utils/require-user-session";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { validateWorkspaceAccess } from "../../utils/validate-workspace-access";
import { workspaceIdParam } from "../schema";
import { checkoutSchema } from "../response";
import { isBillingEnabled } from "../config";
import {
  aiBillingEnabled,
  marginBps,
  MAX_TOPUP_CENTS,
  MIN_TOPUP_CENTS,
  topupProductId,
} from "./config";
import { createTopup } from "./create-topup";
import { readWallet } from "./wallet";

const walletSchema = z.object({
  enabled: z.boolean(),
  multiplierBps: z.number().int(),
  balanceMicroUsd: z.string(),
  reservedMicroUsd: z.string(),
  availableMicroUsd: z.string(),
  trialGranted: z.boolean(),
  topup: z
    .object({ minimumCents: z.number().int(), maximumCents: z.number().int() })
    .nullable(),
  entries: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      amount: z.string(),
      model: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
const readRoute = createRoute({
  hide: true,
  method: "get",
  path: "/{workspaceId}/ai",
  operationId: "getAiWallet",
  tags: ["Billing"],
  summary: "Get workspace AI credit",
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse(
      "AI credit and recent usage in integer microdollars (USD)",
      walletSchema,
    ),
    404: errorResponse("Workspace not found"),
  },
});
const purchaseRoute = createRoute({
  hide: true,
  method: "post",
  path: "/{workspaceId}/ai/topups",
  operationId: "createAiTopup",
  tags: ["Billing"],
  summary: "Buy prepaid AI credit",
  middleware: [
    requireUserSession,
    workspaceAccessMiddleware({
      sources: [{ type: "param", key: "workspaceId" }],
    }),
    requireWorkspacePermission({ workspace: ["manage_settings"] }),
  ] as const,
  request: {
    params: workspaceIdParam,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            cents: z
              .number()
              .int()
              .min(MIN_TOPUP_CENTS)
              .max(MAX_TOPUP_CENTS)
              .openapi({
                description:
                  "Custom top-up amount in USD cents, minimum 500 ($5).",
              }),
            requestId: z.uuid(),
          }),
        },
      },
    },
  },
  responses: {
    200: jsonResponse("Creem top-up checkout", checkoutSchema),
    400: errorResponse("Unavailable top-up"),
    403: errorResponse("Billing management permission required"),
    404: errorResponse("Workspace not found"),
    409: errorResponse("Request conflict"),
    503: errorResponse("Billing unavailable"),
  },
});

export const aiBillingRoutes = apiRouter<BaseVariables>()
  .openapi(readRoute, async (c) => {
    const { workspaceId } = c.req.valid("param");
    await validateWorkspaceAccess(c.get("userId"), workspaceId);
    if (!aiBillingEnabled())
      return c.json(
        {
          enabled: false,
          multiplierBps: 10000,
          balanceMicroUsd: "0",
          reservedMicroUsd: "0",
          availableMicroUsd: "0",
          trialGranted: false,
          topup: null,
          entries: [],
        },
        200,
      );
    return c.json(
      {
        enabled: true,
        multiplierBps: marginBps(),
        ...(await readWallet(workspaceId)),
        topup:
          isBillingEnabled() && topupProductId()
            ? { minimumCents: MIN_TOPUP_CENTS, maximumCents: MAX_TOPUP_CENTS }
            : null,
      },
      200,
    );
  })
  .openapi(purchaseRoute, async (c) => {
    if (!aiBillingEnabled())
      throw new HTTPException(404, { message: "Not found" });
    const { workspaceId } = c.req.valid("param");
    await validateWorkspaceAccess(c.get("userId"), workspaceId);
    const { cents, requestId } = c.req.valid("json");
    return c.json(
      await createTopup(
        workspaceId,
        c.get("userId"),
        c.get("userEmail") ?? "",
        cents,
        requestId,
      ),
      200,
    );
  });
