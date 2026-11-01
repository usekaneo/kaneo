import { apiRouter, createRoute, jsonResponse, z } from "../../openapi";
import { middleware, mutationMiddleware, errors } from "./common";
import { getEffectiveAgentConfig } from "../effective-config";
import { getModelLabel } from "../model-label";
import { createConversation } from "../controllers/create-conversation";
import { getConversation } from "../controllers/get-conversation";
import { listConversations } from "../controllers/list-conversations";
import { setConversationSharing } from "../controllers/set-conversation-sharing";
import {
  configResponse,
  conversationDetailResponse,
  conversationResponse,
} from "../response";
import {
  conversationParams,
  workspaceParams,
  createConversationSchema,
  listConversationsQuery,
} from "../schema";

function sharingRoute(shared: boolean) {
  return createRoute({
    method: "post",
    path: `/{workspaceId}/conversations/{conversationId}/${shared ? "share" : "unshare"}`,
    operationId: shared ? "shareAgentConversation" : "unshareAgentConversation",
    tags: ["Agent"],
    summary: shared
      ? "Share your conversation with the workspace"
      : "Make your shared conversation private again",
    description: shared
      ? "Members who can read the conversation's project and every project a run touched can view that run, its proposals, and attachments read-only. The conversation header is visible when it has no runs or at least one visible run. Only the owner can share. Repeating the request keeps the original sharedAt."
      : "Revokes other members' access immediately. Only the owner can unshare.",
    // Revoking must keep working without an entitlement.
    middleware: shared ? mutationMiddleware : middleware,
    request: { params: conversationParams },
    responses: {
      200: jsonResponse("Updated conversation", conversationResponse),
      ...errors,
    },
  });
}

const routes = apiRouter()
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/config",
      operationId: "getEffectiveAgentConfig",
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
      const config = await getEffectiveAgentConfig();
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
      summary: "Create an agent conversation, private until shared",
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
      summary: "List your conversations",
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
  )
  .openapi(
    createRoute({
      method: "get",
      path: "/{workspaceId}/conversations/{conversationId}",
      operationId: "getAgentConversation",
      tags: ["Agent"],
      summary: "Read a conversation you own or that is shared with you",
      middleware,
      request: { params: conversationParams },
      responses: {
        200: jsonResponse(
          "Conversation with its owner",
          conversationDetailResponse,
        ),
        ...errors,
      },
    }),
    async (c) => {
      const { workspaceId, conversationId } = c.req.valid("param");
      return c.json(
        await getConversation(
          { userId: c.get("userId"), workspaceId, projectId: null },
          conversationId,
        ),
        200,
      );
    },
  )
  .openapi(sharingRoute(true), async (c) => {
    const { workspaceId, conversationId } = c.req.valid("param");
    return c.json(
      await setConversationSharing(
        { userId: c.get("userId"), workspaceId, projectId: null },
        conversationId,
        true,
      ),
      200,
    );
  })
  .openapi(sharingRoute(false), async (c) => {
    const { workspaceId, conversationId } = c.req.valid("param");
    return c.json(
      await setConversationSharing(
        { userId: c.get("userId"), workspaceId, projectId: null },
        conversationId,
        false,
      ),
      200,
    );
  });
export default routes;
