import { apiRouter, createRoute, jsonResponse, z } from "../../openapi";
import { middleware, mutationMiddleware, errors } from "./common";
import { applyProposals } from "../controllers/apply-proposals";
import { discardProposals } from "../controllers/discard-proposals";
import { undoProposal } from "../controllers/undo-proposal";
import { applyResponse } from "../response";
import { proposalParams, runParams, selectProposalsSchema } from "../schema";

const routes = apiRouter()
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/runs/{runId}/apply",
      operationId: "applyAgentProposals",
      tags: ["Agent"],
      summary: "Apply selected saved proposals",
      description:
        "Each proposal is applied atomically with its receipt. Checks current permissions and affected fields; retries cannot duplicate task creation or comments. Independent proposals return individual conflicts. No model call is made.",
      middleware: mutationMiddleware,
      request: {
        params: runParams,
        body: {
          required: true,
          content: { "application/json": { schema: selectProposalsSchema } },
        },
      },
      responses: {
        200: jsonResponse("Per-proposal application results", applyResponse),
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, runId } = c.req.valid("param");
      return c.json(
        await applyProposals(
          { userId: c.get("userId"), workspaceId, projectId: null },
          runId,
          c.req.valid("json").proposalIds,
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/runs/{runId}/discard",
      operationId: "discardAgentProposals",
      tags: ["Agent"],
      summary: "Discard selected pending proposals",
      middleware,
      request: {
        params: runParams,
        body: {
          required: true,
          content: { "application/json": { schema: selectProposalsSchema } },
        },
      },
      responses: {
        200: jsonResponse(
          "Discarded IDs",
          z.object({ proposalIds: z.array(z.string()) }),
        ),
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, runId } = c.req.valid("param");
      return c.json(
        await discardProposals(
          { userId: c.get("userId"), workspaceId, projectId: null },
          runId,
          c.req.valid("json").proposalIds,
        ),
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/proposals/{proposalId}/undo",
      operationId: "undoAgentProposal",
      tags: ["Agent"],
      summary: "Undo an applied task update or comment",
      description:
        "Only restores affected fields that still match the agent's applied values, and only deletes a posted comment that has not been edited. Rechecks current permissions and assignee membership. Task creation is not automatically undone; delete created tasks through the task API.",
      middleware: mutationMiddleware,
      request: { params: proposalParams },
      responses: {
        200: jsonResponse(
          "Undone proposal",
          z.object({ id: z.string(), status: z.literal("undone") }),
        ),
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, proposalId } = c.req.valid("param");
      return c.json(
        await undoProposal(
          { userId: c.get("userId"), workspaceId, projectId: null },
          proposalId,
        ),
        200,
      );
    },
  );
export default routes;
