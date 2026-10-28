import { apiRouter, createRoute, jsonResponse, z } from "../../openapi";
import { requireWorkspacePermission } from "../../utils/require-workspace-permission";
import { middleware, mutationMiddleware, errors } from "./common";
import { workspaceParams } from "../schema";
import { runStateResponse } from "../response";
import {
  automationParams,
  createAutomationSchema,
  listAutomationsQuery,
  listAutomationRunsQuery,
} from "../automation/schema";
import {
  automationListResponse,
  automationResponse,
  automationRunResponse,
  deletedAutomationResponse,
} from "../automation/response";
import { saveAutomation } from "../automation/controllers/save";
import { getAutomation } from "../automation/controllers/get";
import { listAutomations } from "../automation/controllers/list";
import { setAutomationEnabled } from "../automation/controllers/set-enabled";
import { deleteAutomation } from "../automation/controllers/delete";
import { takeOverAutomation } from "../automation/controllers/take-over";
import { runAutomationNow } from "../automation/controllers/run-now";
import { listAutomationRuns } from "../automation/controllers/list-runs";
import type { Context } from "hono";

const subject = (c: Context) => ({
  userId: c.get("userId"),
  workspaceId: c.req.param("workspaceId") ?? "",
  projectId: null,
});
const tags = ["Agent Automations"];
const path = "/{workspaceId}/automations";
const item = `${path}/{automationId}`;
const body = (schema: typeof createAutomationSchema) => ({
  required: true as const,
  content: { "application/json": { schema } },
});

export default apiRouter()
  .openapi(
    createRoute({
      method: "get",
      path,
      tags,
      operationId: "listAgentAutomations",
      summary: "List automations and read-only workflow rules",
      middleware,
      request: { params: workspaceParams, query: listAutomationsQuery },
      responses: {
        200: jsonResponse("Automations", automationListResponse),
        ...errors,
      },
    }),
    async (c) =>
      c.json(await listAutomations(subject(c), c.req.valid("query")), 200),
  )
  .openapi(
    createRoute({
      method: "post",
      path,
      tags,
      operationId: "createAgentAutomation",
      summary: "Create an automation",
      middleware: mutationMiddleware,
      request: { params: workspaceParams, body: body(createAutomationSchema) },
      responses: {
        201: jsonResponse("Created automation", automationResponse),
        ...errors,
      },
    }),
    async (c) => {
      const id = await saveAutomation(subject(c), c.req.valid("json"));
      return c.json(await getAutomation(subject(c), id), 201);
    },
  )
  .openapi(
    createRoute({
      method: "get",
      path: item,
      tags,
      operationId: "getAgentAutomation",
      summary: "Get an automation",
      middleware,
      request: { params: automationParams },
      responses: {
        200: jsonResponse("Automation", automationResponse),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await getAutomation(subject(c), c.req.valid("param").automationId),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "put",
      path: item,
      tags,
      operationId: "updateAgentAutomation",
      summary:
        "Replace automation settings; scope changes use a private conversation",
      middleware: mutationMiddleware,
      request: { params: automationParams, body: body(createAutomationSchema) },
      responses: {
        200: jsonResponse("Updated automation", automationResponse),
        ...errors,
      },
    }),
    async (c) => {
      const id = await saveAutomation(
        subject(c),
        c.req.valid("json"),
        c.req.valid("param").automationId,
      );
      return c.json(await getAutomation(subject(c), id), 200);
    },
  )
  .openapi(
    createRoute({
      method: "delete",
      path: item,
      tags,
      operationId: "deleteAgentAutomation",
      summary:
        "Delete an automation; retain owned conversation history and cost records",
      middleware,
      request: { params: automationParams },
      responses: {
        200: jsonResponse("Deleted automation", deletedAutomationResponse),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await deleteAutomation(subject(c), c.req.valid("param").automationId),
        200,
      ),
  )
  .openapi(
    createRoute({
      method: "patch",
      path: `${item}/enabled`,
      tags,
      operationId: "setAgentAutomationEnabled",
      summary: "Enable or disable an automation",
      middleware,
      request: {
        params: automationParams,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z.object({ enabled: z.boolean() }).strict(),
            },
          },
        },
      },
      responses: {
        200: jsonResponse("Updated automation", automationResponse),
        ...errors,
      },
    }),
    async (c) => {
      const id = c.req.valid("param").automationId;
      await setAutomationEnabled(subject(c), id, c.req.valid("json").enabled);
      return c.json(await getAutomation(subject(c), id), 200);
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: `${item}/take-over`,
      tags,
      operationId: "takeOverAgentAutomation",
      summary:
        "Take ownership, starting with a private conversation and disabled trigger",
      middleware: [
        ...mutationMiddleware,
        requireWorkspacePermission({ agent: ["manage_automations"] }),
      ],
      request: { params: automationParams },
      responses: {
        200: jsonResponse("Automation taken over", automationResponse),
        ...errors,
      },
    }),
    async (c) => {
      const id = c.req.valid("param").automationId;
      await takeOverAutomation(subject(c), id);
      return c.json(await getAutomation(subject(c), id), 200);
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: `${item}/runs`,
      tags,
      operationId: "runAgentAutomation",
      summary: "Run now, respecting daily and workspace budget caps",
      middleware: mutationMiddleware,
      request: { params: automationParams },
      responses: {
        202: jsonResponse("Queued run", runStateResponse),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await runAutomationNow(subject(c), c.req.valid("param").automationId),
        202,
      ),
  )
  .openapi(
    createRoute({
      method: "get",
      path: `${item}/runs`,
      tags,
      operationId: "listAgentAutomationRuns",
      summary: "Run history visible to the current owner or shared viewer",
      middleware,
      request: { params: automationParams, query: listAutomationRunsQuery },
      responses: {
        200: jsonResponse("Runs", z.array(automationRunResponse)),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await listAutomationRuns(
          subject(c),
          c.req.valid("param").automationId,
          c.req.valid("query"),
        ),
        200,
      ),
  );
