import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import {
  loadTangledConnection,
  withTangledConnection,
} from "../plugins/tangled/connection";
import { tangledRefSchema } from "../plugins/tangled/api-contract";
import { validateTangledPayload } from "../plugins/tangled/payload";
import { reconcileTangledBranch } from "../plugins/tangled/reconcile-branch";
import { recordTangledOutcome } from "../plugins/tangled/record-outcome";
import { verifyTangledSignature } from "../plugins/tangled/utils/verify-signature";
import { boundedRequestBody } from "../utils/bounded-request-body";

const webhookRoute = createRoute({
  method: "post",
  path: "/webhook/{integrationId}",
  operationId: "receiveTangledWebhook",
  tags: ["Tangled"],
  summary: "Receive a signed Tangled repository webhook",
  description:
    "Send the raw JSON payload with X-Tangled-Event and X-Tangled-Signature-256. The HMAC-SHA256 signature covers the exact request bytes. Branch pushes reconcile the current head; PR events are recorded as unsupported without changing tasks.",
  security: [],
  middleware: [boundedRequestBody(1_048_576)],
  request: { params: z.object({ integrationId: z.string().min(1).max(256) }) },
  responses: {
    200: jsonResponse(
      "Delivery processed durably",
      z.object({ status: z.enum(["processed", "skipped"]) }),
    ),
    400: errorResponse("Invalid payload or conflicting event headers"),
    401: errorResponse("Missing or invalid signature"),
    403: errorResponse("Payload repository does not match the connection"),
    404: errorResponse("Active Tangled connection not found"),
    408: errorResponse("Request body timed out"),
    409: errorResponse("Connection changed during processing"),
    413: errorResponse("Request body exceeds one MiB"),
    500: errorResponse("Invalid stored connection"),
    503: errorResponse("Processing failed; delivery can be retried"),
  },
});

// No body validator runs before authentication: signatures cover unparsed bytes.
export const tangledWebhook = apiRouter().openapi(webhookRoute, async (c) => {
  try {
    const connection = await loadTangledConnection(
      c.req.valid("param").integrationId,
    );
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (
      !verifyTangledSignature(
        bytes,
        connection.parsed.webhookSecret,
        c.req.header("x-tangled-signature-256"),
      )
    ) {
      throw new HTTPException(401, {
        message: "Invalid Tangled webhook signature",
      });
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    } catch {
      throw new HTTPException(400, { message: "Invalid Tangled webhook JSON" });
    }
    const payload = validateTangledPayload(
      c.req.header("x-tangled-event"),
      value,
    );
    if (!payload)
      throw new HTTPException(400, {
        message: "Unsupported or invalid Tangled event",
      });
    const headerRepo = c.req.header("x-tangled-repo");
    if (headerRepo && headerRepo !== payload.repositoryFullName) {
      throw new HTTPException(400, {
        message: "Tangled repository header conflicts with signed payload",
      });
    }
    if (payload.repositoryFullName !== connection.parsed.repositoryFullName) {
      throw new HTTPException(403, {
        message: "Tangled webhook repository does not match this connection",
      });
    }
    if (
      payload.type === "push" &&
      (payload.ref.length > 1024 ||
        (payload.refType === "branch" &&
          !tangledRefSchema.shape.name.safeParse(payload.ref).success))
    ) {
      throw new HTTPException(400, {
        message: "Invalid Tangled branch reference",
      });
    }
    if (payload.type === "pull_request" || payload.refType === "tag") {
      await withTangledConnection(connection, null, (tx) =>
        recordTangledOutcome(tx, connection.id, {
          eventType: payload.type,
          outcome: "skipped",
          code:
            payload.type === "pull_request"
              ? "pull_request_unsupported"
              : "tag_ignored",
          ref: payload.type === "push" ? payload.ref : null,
        }),
      );
      return c.json({ status: "skipped" as const }, 200);
    }
    const outcome = await reconcileTangledBranch(connection, payload.ref);
    if (outcome.outcome === "failed")
      throw new HTTPException(503, {
        message:
          "Tangled branch reconciliation failed; retry delivery or check the connection outcome",
      });
    if (outcome.code === "branch_missing")
      return c.json({ status: "skipped" as const }, 200);
    return c.json({ status: "processed" as const }, 200);
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    throw new HTTPException(503, {
      message: "Tangled delivery could not be committed; retry later",
    });
  }
});
