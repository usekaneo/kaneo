import { apiRouter, createRoute, jsonResponse, z } from "../../openapi";
import { middleware, mutationMiddleware, errors } from "./common";
import { streamSSE } from "hono/streaming";
import { createRun } from "../controllers/create-run";
import { listRuns } from "../controllers/list-runs";
import { listRecentRuns } from "../controllers/list-recent-runs";
import { getRun } from "../controllers/get-run";
import { cancelRun } from "../controllers/cancel-run";
import {
  recentRunResponse,
  runDetailResponse,
  runResponse,
  runStateResponse,
} from "../response";
import {
  conversationParams,
  createRunSchema,
  listQuery,
  runParams,
  workspaceParams,
} from "../schema";

const routes = apiRouter()
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/conversations/{conversationId}/runs",
      operationId: "createAgentRun",
      tags: ["Agent"],
      summary: "Queue a bounded agent run",
      description:
        "requestId is an idempotency key scoped to this conversation. Repeating it with the same prompt (including its mentions), attachments, and model returns the existing run; any difference conflicts. Tools can read scoped data and save proposals, never apply changes.",
      middleware: mutationMiddleware,
      request: {
        params: conversationParams,
        body: {
          required: true,
          content: { "application/json": { schema: createRunSchema } },
        },
      },
      responses: {
        202: jsonResponse("Queued or existing run", runStateResponse),
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, conversationId } = c.req.valid("param");
      return c.json(
        await createRun(
          { userId: c.get("userId"), workspaceId, projectId: null },
          conversationId,
          c.req.valid("json"),
        ),
        202,
      );
    },
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/conversations/{conversationId}/runs",
      operationId: "listAgentRuns",
      tags: ["Agent"],
      summary: "List runs in a conversation you own or that is shared with you",
      middleware,
      request: { params: conversationParams, query: listQuery },
      responses: {
        200: jsonResponse("Run page, newest first", z.array(runResponse)),
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, conversationId } = c.req.valid("param");
      return c.json(
        await listRuns(
          { userId: c.get("userId"), workspaceId, projectId: null },
          conversationId,
          c.req.valid("query"),
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/runs",
      operationId: "listRecentAgentRuns",
      tags: ["Agent"],
      summary: "List your recent runs and runs shared with you",
      description:
        "Includes runs from conversations other members shared, when you can read their project. Each run names its conversation owner.",
      middleware,
      request: { params: workspaceParams, query: listQuery },
      responses: {
        200: jsonResponse(
          "Run page with proposal counts, newest first",
          z.array(recentRunResponse),
        ),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await listRecentRuns(
          {
            userId: c.get("userId"),
            workspaceId: c.req.valid("param").workspaceId,
            projectId: null,
          },
          c.req.valid("query"),
        ),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/runs/{runId}",
      operationId: "getAgentRun",
      tags: ["Agent"],
      summary: "Read a run, its tool progress, and proposals",
      description:
        "Owners and, for shared conversations, members who can read its project may read it. Only the owner can act on it.",
      middleware,
      request: { params: runParams },
      responses: {
        200: jsonResponse("Run details", runDetailResponse),
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, runId } = c.req.valid("param");
      return c.json(
        await getRun(
          { userId: c.get("userId"), workspaceId, projectId: null },
          runId,
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/runs/{runId}/events",
      operationId: "streamAgentRun",
      tags: ["Agent"],
      summary: "Stream a persisted run state",
      description:
        "Authenticated SSE. Sends a run event when persisted state changes, then a done event on a terminal state or awaiting_review. Reconnect through this endpoint or GET the run. Access is rechecked on each poll.",
      middleware,
      request: { params: runParams },
      responses: {
        200: {
          description: "Server-sent events",
          content: { "text/event-stream": { schema: z.string() } },
        },
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, runId } = c.req.valid("param");
      const actor = { userId: c.get("userId"), workspaceId, projectId: null };
      const initial = await getRun(actor, runId);
      return streamSSE(c, async (stream) => {
        let previous = "",
          current = initial;
        const deadline = Date.now() + 120000;
        while (!stream.aborted && Date.now() < deadline) {
          const data = JSON.stringify(current);
          if (data !== previous) {
            await stream.writeSSE({ event: "run", data });
            previous = data;
          }
          if (!["queued", "running"].includes(current.status)) {
            await stream.writeSSE({ event: "done", data: current.status });
            return;
          }
          await stream.sleep(1000);
          if (stream.aborted) return;
          try {
            current = await getRun(actor, runId);
          } catch {
            await stream.writeSSE({
              event: "error",
              data: "Run is no longer accessible",
            });
            return;
          }
        }
      });
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/runs/{runId}/cancel",
      operationId: "cancelAgentRun",
      tags: ["Agent"],
      summary: "Cancel your queued or running run",
      middleware,
      request: { params: runParams },
      responses: {
        200: jsonResponse("Current run status", runStateResponse),
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, runId } = c.req.valid("param");
      return c.json(
        await cancelRun(
          { userId: c.get("userId"), workspaceId, projectId: null },
          runId,
        ),
        200,
      );
    },
  );
export default routes;
