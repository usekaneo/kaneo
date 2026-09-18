import { streamSSE } from "hono/streaming";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  nullableResponseTimestamp,
  responseTimestamp,
  z,
} from "../openapi";
import { hasWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { addUserListener } from "../ws";
import {
  addChannelMembers,
  createChannel,
  deleteChannel,
  deleteMessage,
  editMessage,
  joinChannel,
  leaveChannel,
  listConversations,
  listMessages,
  markRead,
  openDirectMessage,
  sendMessage,
  toggleReaction,
  typing,
} from "./controllers";

const tags = ["Chat"];
const workspaceQuery = z.object({ workspaceId: z.string() });
const idParam = z.object({ id: z.string() });
const messageParam = z.object({ messageId: z.string() });
const json = <T>(schema: T) => ({
  required: true,
  content: { "application/json": { schema } },
});

const messageBody = z.string().trim().min(1).max(4000);
const userIds = z.array(z.string()).max(50);

const personSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    lastReadAt: responseTimestamp.openapi({
      description: "Messages before this have been seen by this person.",
    }),
  })
  .openapi("ChatPerson");

const conversationSchema = z
  .object({
    id: z.string(),
    type: z.enum(["channel", "dm"]),
    name: z.string().nullable().openapi({ description: "Null for DMs." }),
    isPrivate: z.boolean(),
    createdBy: z.string().nullable(),
    joined: z.boolean().openapi({
      description: "False for open channels the caller can join.",
    }),
    members: z.array(personSchema),
    unreadCount: z.number(),
    lastMessage: z
      .object({
        body: z.string(),
        userName: z.string().nullable(),
        createdAt: responseTimestamp,
      })
      .nullable(),
    createdAt: responseTimestamp,
  })
  .openapi("ChatConversation");

const messageSchema = z
  .object({
    id: z.string(),
    conversationId: z.string(),
    userId: z.string().nullable(),
    userName: z.string().nullable(),
    userImage: z.string().nullable(),
    body: z.string(),
    replyTo: z
      .object({
        id: z.string(),
        body: z.string(),
        userName: z.string().nullable(),
      })
      .nullable()
      .openapi({
        description: "The quoted message; null once it has been deleted.",
      }),
    reactions: z.array(
      z.object({ emoji: z.string(), userIds: z.array(z.string()) }),
    ),
    editedAt: nullableResponseTimestamp,
    createdAt: responseTimestamp,
  })
  .openapi("ChatMessage");

const idSchema = z.object({ id: z.string() }).openapi("ChatId");

const listConversationsRoute = createRoute({
  method: "get",
  operationId: "listChatConversations",
  path: "/",
  tags,
  summary: "List conversations",
  description:
    "Channels and direct messages the caller is in, plus open channels they can join, most recently active first.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: workspaceQuery },
  responses: {
    200: jsonResponse("Conversations", z.array(conversationSchema)),
    403: errorResponse("No access to the workspace"),
  },
});

const createChannelRoute = createRoute({
  method: "post",
  operationId: "createChatChannel",
  path: "/channels",
  tags,
  summary: "Create a channel",
  description:
    "Open channels can be joined by anyone in the workspace; private ones only by the people added.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    body: json(
      z.object({
        workspaceId: z.string(),
        name: z.string().trim().min(1).max(80).openapi({ example: "general" }),
        isPrivate: z.boolean().default(false),
        memberIds: userIds.default([]),
      }),
    ),
  },
  responses: {
    200: jsonResponse("Created", idSchema),
    400: errorResponse("Someone listed is not in the workspace"),
    409: errorResponse("A channel with that name already exists"),
  },
});

const openDmRoute = createRoute({
  method: "post",
  operationId: "openChatDirectMessage",
  path: "/dms",
  tags,
  summary: "Open a direct message",
  description:
    "Returns the existing conversation with exactly these people, or starts one. Pass several ids for a group DM.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    body: json(z.object({ workspaceId: z.string(), userIds: userIds.min(1) })),
  },
  responses: {
    200: jsonResponse("The conversation", idSchema),
    400: errorResponse("Someone listed is not in the workspace"),
  },
});

const joinRoute = createRoute({
  method: "post",
  operationId: "joinChatChannel",
  path: "/{id}/join",
  tags,
  summary: "Join an open channel",
  middleware: [workspaceAccess.fromBody()] as const,
  request: { params: idParam, body: json(workspaceQuery) },
  responses: {
    200: jsonResponse("Joined", idSchema),
    403: errorResponse("The channel is private"),
    404: errorResponse("Not found"),
  },
});

const leaveRoute = createRoute({
  method: "post",
  operationId: "leaveChatChannel",
  path: "/{id}/leave",
  tags,
  summary: "Leave a channel",
  middleware: [workspaceAccess.fromBody()] as const,
  request: { params: idParam, body: json(workspaceQuery) },
  responses: {
    200: jsonResponse("Left", idSchema),
    400: errorResponse("Direct messages can't be left"),
    404: errorResponse("Not found"),
  },
});

const addMembersRoute = createRoute({
  method: "post",
  operationId: "addChatChannelMembers",
  path: "/{id}/members",
  tags,
  summary: "Add people to a channel",
  description: "Anyone in the channel can add others from the workspace.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    params: idParam,
    body: json(z.object({ workspaceId: z.string(), userIds: userIds.min(1) })),
  },
  responses: {
    200: jsonResponse("Added", idSchema),
    403: errorResponse("Not in the channel"),
    404: errorResponse("Not found"),
  },
});

const deleteChannelRoute = createRoute({
  method: "delete",
  operationId: "deleteChatChannel",
  path: "/{id}",
  tags,
  summary: "Delete a channel",
  description:
    "Deletes the channel and its messages. Whoever created it, or anyone with workspace:manage_settings.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { params: idParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("Deleted", idSchema),
    403: errorResponse(
      "Not the creator, and missing workspace:manage_settings",
    ),
    404: errorResponse("Not found"),
  },
});

const listMessagesRoute = createRoute({
  method: "get",
  operationId: "listChatMessages",
  path: "/{id}/messages",
  tags,
  summary: "List messages",
  description:
    "Oldest first. Pass the id of the oldest loaded message as `before` to page back.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: {
    params: idParam,
    query: workspaceQuery.extend({
      before: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  },
  responses: {
    200: jsonResponse(
      "Messages",
      z
        .object({ messages: z.array(messageSchema), hasMore: z.boolean() })
        .openapi("ChatMessagePage"),
    ),
    404: errorResponse("Not found"),
  },
});

const sendMessageRoute = createRoute({
  method: "post",
  operationId: "sendChatMessage",
  path: "/{id}/messages",
  tags,
  summary: "Send a message",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    params: idParam,
    body: json(
      z.object({
        workspaceId: z.string(),
        body: messageBody,
        replyToId: z.string().optional().openapi({
          description: "Quote another message in the same conversation.",
        }),
      }),
    ),
  },
  responses: {
    200: jsonResponse("Sent", messageSchema),
    400: errorResponse("The quoted message is not in this conversation"),
    403: errorResponse("Not in the conversation"),
    404: errorResponse("Not found"),
  },
});

const markReadRoute = createRoute({
  method: "post",
  operationId: "markChatRead",
  path: "/{id}/read",
  tags,
  summary: "Mark a conversation read",
  middleware: [workspaceAccess.fromBody()] as const,
  request: { params: idParam, body: json(workspaceQuery) },
  responses: {
    200: jsonResponse("Marked", idSchema),
    404: errorResponse("Not found"),
  },
});

const editMessageRoute = createRoute({
  method: "patch",
  operationId: "editChatMessage",
  path: "/messages/{messageId}",
  tags,
  summary: "Edit your message",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    params: messageParam,
    body: json(z.object({ workspaceId: z.string(), body: messageBody })),
  },
  responses: {
    200: jsonResponse("Edited", messageSchema),
    403: errorResponse("Not your message"),
    404: errorResponse("Not found"),
  },
});

const deleteMessageRoute = createRoute({
  method: "delete",
  operationId: "deleteChatMessage",
  path: "/messages/{messageId}",
  tags,
  summary: "Delete your message",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { params: messageParam, query: workspaceQuery },
  responses: {
    200: jsonResponse("Deleted", idSchema),
    403: errorResponse("Not your message"),
    404: errorResponse("Not found"),
  },
});

const streamRoute = createRoute({
  method: "get",
  operationId: "streamChat",
  path: "/stream",
  tags,
  summary: "Live chat events",
  description:
    "Server-sent events for the caller's conversations in this workspace: `ready` once connected (refetch then, to catch anything missed), `CHAT_MESSAGE` with the new message, `CHAT_UPDATED` when a conversation or message changed, and `ping` every 25 seconds.",
  middleware: [workspaceAccess.fromQuery()] as const,
  request: { query: workspaceQuery },
  responses: {
    200: {
      description: "An event stream",
      content: { "text/event-stream": { schema: z.string() } },
    },
    403: errorResponse("No access to the workspace"),
  },
});

const reactionRoute = createRoute({
  method: "post",
  operationId: "toggleChatReaction",
  path: "/messages/{messageId}/reactions",
  tags,
  summary: "React to a message",
  description: "Adds the caller's emoji, or removes it when already there.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: {
    params: messageParam,
    body: json(
      z.object({
        workspaceId: z.string(),
        emoji: z
          .string()
          .min(1)
          .max(16)
          .regex(/^\p{Extended_Pictographic}/u, "Pick an emoji")
          .openapi({ example: "👍" }),
      }),
    ),
  },
  responses: {
    200: jsonResponse("The message with its reactions", messageSchema),
    403: errorResponse("Not in the conversation"),
    404: errorResponse("Not found"),
  },
});

const typingRoute = createRoute({
  method: "post",
  operationId: "chatTyping",
  path: "/{id}/typing",
  tags,
  summary: "Say you're typing",
  description:
    "Shows the others a typing indicator. Send again every few seconds while typing; it fades on its own.",
  middleware: [workspaceAccess.fromBody()] as const,
  request: { params: idParam, body: json(workspaceQuery) },
  responses: {
    200: jsonResponse("Sent", idSchema),
    403: errorResponse("Not in the conversation"),
  },
});

const KEEPALIVE_MS = 25_000;

const chat = apiRouter()
  .openapi(streamRoute, (c) => {
    const { workspaceId } = c.req.valid("query");
    const userId = c.get("userId");
    // Stops proxies such as nginx from holding events back in a buffer.
    c.header("X-Accel-Buffering", "no");
    return streamSSE(c, async (stream) => {
      const unsubscribe = addUserListener(userId, (message) => {
        if (
          !message.type.startsWith("CHAT_") ||
          message.workspaceId !== workspaceId
        ) {
          return;
        }
        void stream
          .writeSSE({ event: message.type, data: JSON.stringify(message) })
          .catch(() => {});
      });
      stream.onAbort(unsubscribe);

      await stream.writeSSE({ event: "ready", data: "{}" });
      while (!stream.aborted) {
        await stream.sleep(KEEPALIVE_MS);
        if (stream.aborted) break;
        await stream.writeSSE({ event: "ping", data: "" }).catch(() => {});
      }
      unsubscribe();
    });
  })
  .openapi(listConversationsRoute, async (c) =>
    c.json(
      await listConversations(
        c.req.valid("query").workspaceId,
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(createChannelRoute, async (c) => {
    const { workspaceId, ...input } = c.req.valid("json");
    return c.json(
      await createChannel(workspaceId, c.get("userId"), input),
      200,
    );
  })
  .openapi(openDmRoute, async (c) => {
    const { workspaceId, userIds: others } = c.req.valid("json");
    return c.json(
      await openDirectMessage(workspaceId, c.get("userId"), others),
      200,
    );
  })
  .openapi(joinRoute, async (c) =>
    c.json(
      await joinChannel(
        c.req.valid("json").workspaceId,
        c.req.valid("param").id,
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(leaveRoute, async (c) =>
    c.json(
      await leaveChannel(
        c.req.valid("json").workspaceId,
        c.req.valid("param").id,
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(addMembersRoute, async (c) => {
    const { workspaceId, userIds: added } = c.req.valid("json");
    return c.json(
      await addChannelMembers(
        workspaceId,
        c.req.valid("param").id,
        c.get("userId"),
        added,
      ),
      200,
    );
  })
  .openapi(deleteChannelRoute, async (c) =>
    c.json(
      await deleteChannel(
        c.req.valid("query").workspaceId,
        c.req.valid("param").id,
        c.get("userId"),
        await hasWorkspacePermission(c, { workspace: ["manage_settings"] }),
      ),
      200,
    ),
  )
  .openapi(listMessagesRoute, async (c) => {
    const { workspaceId, before, limit } = c.req.valid("query");
    return c.json(
      await listMessages(
        workspaceId,
        c.req.valid("param").id,
        c.get("userId"),
        {
          before,
          limit,
        },
      ),
      200,
    );
  })
  .openapi(sendMessageRoute, async (c) => {
    const { workspaceId, body, replyToId } = c.req.valid("json");
    return c.json(
      await sendMessage(
        workspaceId,
        c.req.valid("param").id,
        c.get("userId"),
        body,
        replyToId,
      ),
      200,
    );
  })
  .openapi(reactionRoute, async (c) => {
    const { workspaceId, emoji } = c.req.valid("json");
    return c.json(
      await toggleReaction(
        workspaceId,
        c.req.valid("param").messageId,
        c.get("userId"),
        emoji,
      ),
      200,
    );
  })
  .openapi(typingRoute, async (c) =>
    c.json(
      await typing(
        c.req.valid("json").workspaceId,
        c.req.valid("param").id,
        c.get("userId"),
        c.get("user")?.name ?? "",
      ),
      200,
    ),
  )
  .openapi(markReadRoute, async (c) =>
    c.json(
      await markRead(
        c.req.valid("json").workspaceId,
        c.req.valid("param").id,
        c.get("userId"),
      ),
      200,
    ),
  )
  .openapi(editMessageRoute, async (c) => {
    const { workspaceId, body } = c.req.valid("json");
    return c.json(
      await editMessage(
        workspaceId,
        c.req.valid("param").messageId,
        c.get("userId"),
        body,
      ),
      200,
    );
  })
  .openapi(deleteMessageRoute, async (c) =>
    c.json(
      await deleteMessage(
        c.req.valid("query").workspaceId,
        c.req.valid("param").messageId,
        c.get("userId"),
      ),
      200,
    ),
  );

export default chat;
