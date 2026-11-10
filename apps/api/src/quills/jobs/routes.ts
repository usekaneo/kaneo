import { and, desc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
  type BaseVariables,
} from "../../openapi";
import { workspaceAccess } from "../../utils/workspace-access-middleware";
import { jobQueue } from "../../database/quills/schema/job-queue";
import { withQuillsRequest } from "../with-quills-request";
import { auditLog } from "../../database/quills/schema/audit-log";
const params = z.object({ workspaceId: z.string().min(1) });
const middleware = [workspaceAccess.fromParam("workspaceId")];
const errors = {
  401: errorResponse("Authentication required"),
  403: errorResponse("Insufficient permission"),
};
export default apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/jobs",
      operationId: "listQuillsJobs",
      tags: ["Quills"],
      summary: "List recent Quills jobs",
      middleware,
      request: {
        params,
        query: z.object({
          before: z
            .string()
            .max(19)
            .regex(/^\d+$/)
            .refine(
              (value) => value.length < 19 || value <= "9223372036854775807",
            )
            .optional(),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        }),
      },
      responses: {
        ...errors,
        200: jsonResponse(
          "Recent jobs",
          z.object({
            jobs: z.array(
              z.object({
                id: z.string(),
                jobId: z.string(),
                queue: z.string(),
                status: z.string(),
                attempts: z.number(),
                maxAttempts: z.number(),
                lastError: z.string().nullable(),
              }),
            ),
            nextCursor: z.string().nullable(),
          }),
        ),
      },
    }),
    async (c) => {
      const { before, limit } = c.req.valid("query");
      const rows = await withQuillsRequest(
        c,
        { action: "manage_settings" },
        (tx) =>
          tx
            .select({
              id: jobQueue.id,
              jobId: jobQueue.jobId,
              queue: jobQueue.queue,
              status: jobQueue.status,
              attempts: jobQueue.attempts,
              maxAttempts: jobQueue.maxAttempts,
              lastError: jobQueue.lastError,
            })
            .from(jobQueue)
            .where(before ? sql`${jobQueue.id}<${BigInt(before)}` : undefined)
            .orderBy(desc(jobQueue.id))
            .limit(limit + 1),
      );
      return c.json(
        {
          jobs: rows
            .slice(0, limit)
            .map((row) => ({ ...row, id: String(row.id) })),
          nextCursor: rows.length > limit ? String(rows[limit - 1]!.id) : null,
        },
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/jobs/{jobId}/retry",
      operationId: "retryQuillsJob",
      tags: ["Quills"],
      summary: "Retry a failed Quills job",
      middleware,
      request: { params: params.extend({ jobId: z.string().min(1).max(200) }) },
      responses: {
        ...errors,
        200: jsonResponse("Job queued", z.object({ retried: z.boolean() })),
        409: errorResponse("Job is not a failed registered job"),
      },
    }),
    async (c) => {
      const { jobId } = c.req.valid("param");
      await withQuillsRequest(
        c,
        { action: "manage_settings" },
        async (tx, actor) => {
          const rows = await tx
            .update(jobQueue)
            .set({
              status: "pending",
              attempts: 0,
              runAt: new Date(),
              lastError: null,
              finishedAt: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(jobQueue.jobId, jobId),
                eq(jobQueue.status, "failed"),
                eq(jobQueue.queue, "quills.event"),
              ),
            )
            .returning({ id: jobQueue.id });
          if (!rows.length)
            throw new HTTPException(409, {
              message: "Job is not a failed registered job",
            });
          await tx.insert(auditLog).values({
            eventType: "job.retried",
            actorType: "user",
            actorPrincipalId: actor.principalId,
            targetType: "job",
            targetId: jobId,
            channel: "api",
          });
        },
      );
      return c.json({ retried: true }, 200);
    },
  );
