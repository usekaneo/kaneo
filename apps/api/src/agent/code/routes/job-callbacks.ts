import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../../../openapi";
import { boundedRequestBody } from "../../../utils/bounded-request-body";
import { withoutOutboundTelemetry } from "../../../utils/sensitive-outbound";
import {
  authenticateJob,
  claimJob,
  failJob,
  heartbeatJob,
  uploadChangeset,
} from "../callbacks";
import { changesetSchema, CHANGESET_REQUEST_BYTES } from "../changeset-schema";
import { JOB_REPORTED_ERRORS } from "../lifecycle";
import { callbackRateLimit } from "../callback-rate-limit";

const params = z.object({ jobId: z.string().min(1).max(128) });
const sensitive: MiddlewareHandler = async (_c, next) =>
  withoutOutboundTelemetry(next);
const common = [sensitive, callbackRateLimit];
const errors = {
  400: errorResponse("Invalid callback or changeset policy violation"),
  403: errorResponse("Invalid job identity or credential"),
  409: errorResponse("Dispatch is still being recorded; retry claim"),
  410: errorResponse("Job is inactive or claim/upload already consumed"),
  413: errorResponse("Body too large"),
  429: errorResponse("Callback rate limit reached"),
  503: errorResponse("Coding jobs unavailable"),
};
function bearer(c: Context) {
  const value = c.req.header("authorization");
  if (!value?.startsWith("Bearer ") || value.length > 16000)
    throw new HTTPException(403, { message: "Job bearer credential required" });
  return value.slice(7);
}
const accepted = z.object({ accepted: z.literal(true) });
const authenticateChangeset: MiddlewareHandler = async (c, next) => {
  // Reject invalid credentials before allocating the large upload buffer.
  // uploadChangeset checks again after reading, so revocation still takes effect.
  await authenticateJob(c.req.param("jobId") ?? "", bearer(c));
  await next();
};
const callbacks = apiRouter()
  .openapi(
    createRoute({
      method: "post",
      path: "/claim",
      operationId: "claimAgentCodeJob",
      tags: ["Agent jobs"],
      security: [],
      summary:
        "Exchange a GitHub Actions OIDC bearer token for a single-job callback credential",
      middleware: [...common, boundedRequestBody(1024)],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: params } },
        },
      },
      responses: {
        200: jsonResponse(
          "Single-use claim and bounded job spec",
          z.object({
            credential: z.string(),
            spec: z.object({
              jobId: z.string(),
              instructions: z.string(),
              context: z.string().max(32000),
              baseSha: z.string(),
              baseRef: z.string(),
              branch: z.string(),
              repository: z.string(),
              model: z.string(),
              deadline: z.string(),
            }),
          }),
        ),
        ...errors,
      },
    }),
    async (c) => {
      c.header("Cache-Control", "no-store");
      return c.json(await claimJob(c.req.valid("json").jobId, bearer(c)), 200);
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/{jobId}/heartbeat",
      operationId: "heartbeatAgentCodeJob",
      tags: ["Agent jobs"],
      security: [],
      summary: "Report a coarse job phase with a job bearer credential",
      middleware: [...common, boundedRequestBody(1024)],
      request: {
        params,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z
                .object({
                  phase: z
                    .enum(["working", "testing", "collecting"])
                    .optional(),
                })
                .strict(),
            },
          },
        },
      },
      responses: {
        200: jsonResponse(
          "Heartbeat accepted",
          z.object({ cancelRequested: z.boolean() }),
        ),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await heartbeatJob(
          c.req.valid("param").jobId,
          bearer(c),
          c.req.valid("json"),
        ),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/{jobId}/changeset",
      operationId: "uploadAgentCodeChangeset",
      tags: ["Agent jobs"],
      security: [],
      summary:
        "Upload a single bounded changeset; Kaneo creates the branch, commit, and draft PR",
      middleware: [
        ...common,
        authenticateChangeset,
        boundedRequestBody(CHANGESET_REQUEST_BYTES),
      ],
      request: {
        params,
        body: {
          required: true,
          content: { "application/json": { schema: changesetSchema } },
        },
      },
      responses: {
        202: jsonResponse("Changeset accepted", accepted),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await uploadChangeset(
          c.req.valid("param").jobId,
          bearer(c),
          c.req.valid("json"),
        ),
        202,
      ),
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/{jobId}/fail",
      operationId: "failAgentCodeJob",
      tags: ["Agent jobs"],
      security: [],
      summary: "Report a stable failure code with a job bearer credential",
      middleware: [...common, boundedRequestBody(1024)],
      request: {
        params,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z.object({ code: z.enum(JOB_REPORTED_ERRORS) }).strict(),
            },
          },
        },
      },
      responses: { 200: jsonResponse("Failure recorded", accepted), ...errors },
    }),
    async (c) =>
      c.json(
        await failJob(
          c.req.valid("param").jobId,
          bearer(c),
          c.req.valid("json").code,
        ),
        200,
      ),
  );
export default callbacks;
