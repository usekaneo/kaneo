import { apiRouter, createRoute, jsonResponse, z } from "../../openapi";
import { middleware, mutationMiddleware, errors } from "./common";
import { getAgentConfig } from "../config";
import { getModelLabel } from "../model-label";
import { createConversation } from "../controllers/create-conversation";
import { listConversations } from "../controllers/list-conversations";
import { configResponse, conversationResponse } from "../response";
import {
  workspaceParams,
  createConversationSchema,
  listConversationsQuery,
} from "../schema";

const routes = apiRouter()
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/config",
      operationId: "getAgentConfig",
      tags: ["Agent"],
      summary: "Get instance agent availability",
      middleware,
      request: { params: workspaceParams },
      responses: {
        200: jsonResponse(
          "Agent availability; never includes credentials",
          configResponse,
        ),
        ...errors,
      },
    }),
    async (c) => {
      const config = getAgentConfig();
      return c.json(
        {
          enabled: Boolean(config),
          model: config?.model ?? null,
          models: (config?.models ?? []).map((id) => ({
            id,
            label: getModelLabel(id),
          })),
          maxSteps: config?.maxSteps ?? null,
          maxOutputTokens: config?.maxOutputTokens ?? null,
        },
        200,
      );
    },
  )
  .openapi(
    createRoute({
      method: "post",
      path: "/{workspaceId}/conversations",
      operationId: "createAgentConversation",
      tags: ["Agent"],
      summary: "Create a private agent conversation",
      middleware: mutationMiddleware,
      request: {
        params: workspaceParams,
        body: {
          required: true,
          content: { "application/json": { schema: createConversationSchema } },
        },
      },
      responses: {
        201: jsonResponse("Private conversation", conversationResponse),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await createConversation(
          {
            userId: c.get("userId"),
            workspaceId: c.req.valid("param").workspaceId,
            projectId: null,
          },
          c.req.valid("json"),
        ),
        201,
      ),
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/conversations",
      operationId: "listAgentConversations",
      tags: ["Agent"],
      summary: "List your private conversations",
      description:
        "Pass projectId to list only conversations scoped to that project.",
      middleware,
      request: { params: workspaceParams, query: listConversationsQuery },
      responses: {
        200: jsonResponse(
          "Conversation page, newest first",
          z.array(conversationResponse),
        ),
        ...errors,
      },
    }),
    async (c) =>
      c.json(
        await listConversations(
          {
            userId: c.get("userId"),
            workspaceId: c.req.valid("param").workspaceId,
            projectId: null,
          },
          c.req.valid("query"),
        ),
        200,
      ),
  );
export default routes;
