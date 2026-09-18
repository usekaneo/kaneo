import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type ChatConversation = InferResponseType<
  (typeof client)["chat"]["$get"],
  200
>[number];
export type ChatMessage = InferResponseType<
  (typeof client)["chat"][":id"]["messages"]["$post"],
  200
>;
export type ChatMessagePage = InferResponseType<
  (typeof client)["chat"][":id"]["messages"]["$get"],
  200
>;

async function unwrap<T>(response: {
  ok: boolean;
  text: () => Promise<string>;
  json: () => Promise<T>;
}) {
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      message = JSON.parse(text).message ?? text;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

export const chatApi = {
  presence: async (workspaceId: string) =>
    unwrap(await client.chat.presence.$get({ query: { workspaceId } })),
  conversations: async (workspaceId: string) =>
    unwrap(await client.chat.$get({ query: { workspaceId } })),
  createChannel: async (json: {
    workspaceId: string;
    name: string;
    isPrivate: boolean;
    memberIds: string[];
  }) => unwrap(await client.chat.channels.$post({ json })),
  openDm: async (workspaceId: string, userIds: string[]) =>
    unwrap(await client.chat.dms.$post({ json: { workspaceId, userIds } })),
  join: async (workspaceId: string, id: string) =>
    unwrap(
      await client.chat[":id"].join.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  leave: async (workspaceId: string, id: string) =>
    unwrap(
      await client.chat[":id"].leave.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  addMembers: async (workspaceId: string, id: string, userIds: string[]) =>
    unwrap(
      await client.chat[":id"].members.$post({
        param: { id },
        json: { workspaceId, userIds },
      }),
    ),
  deleteChannel: async (workspaceId: string, id: string) =>
    unwrap(
      await client.chat[":id"].$delete({
        param: { id },
        query: { workspaceId },
      }),
    ),
  messages: async (workspaceId: string, id: string, before?: string) =>
    unwrap(
      await client.chat[":id"].messages.$get({
        param: { id },
        query: before ? { workspaceId, before } : { workspaceId },
      }),
    ),
  send: async (
    workspaceId: string,
    id: string,
    body: string,
    replyToId?: string,
  ) =>
    unwrap(
      await client.chat[":id"].messages.$post({
        param: { id },
        json: replyToId
          ? { workspaceId, body, replyToId }
          : { workspaceId, body },
      }),
    ),
  react: async (workspaceId: string, messageId: string, emoji: string) =>
    unwrap(
      await client.chat.messages[":messageId"].reactions.$post({
        param: { messageId },
        json: { workspaceId, emoji },
      }),
    ),
  typing: async (workspaceId: string, id: string) =>
    unwrap(
      await client.chat[":id"].typing.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  markRead: async (workspaceId: string, id: string) =>
    unwrap(
      await client.chat[":id"].read.$post({
        param: { id },
        json: { workspaceId },
      }),
    ),
  edit: async (workspaceId: string, messageId: string, body: string) =>
    unwrap(
      await client.chat.messages[":messageId"].$patch({
        param: { messageId },
        json: { workspaceId, body },
      }),
    ),
  remove: async (workspaceId: string, messageId: string) =>
    unwrap(
      await client.chat.messages[":messageId"].$delete({
        param: { messageId },
        query: { workspaceId },
      }),
    ),
};
