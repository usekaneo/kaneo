import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  chatConversationTable,
  chatMemberTable,
  chatMessageTable,
  chatReactionTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import { publishEvent } from "../events";

type Conversation = typeof chatConversationTable.$inferSelect;

const messageColumns = {
  id: chatMessageTable.id,
  conversationId: chatMessageTable.conversationId,
  userId: chatMessageTable.userId,
  userName: userTable.name,
  userImage: userTable.image,
  body: chatMessageTable.body,
  replyToId: chatMessageTable.replyToId,
  editedAt: chatMessageTable.editedAt,
  createdAt: chatMessageTable.createdAt,
};

type MessageRow = {
  id: string;
  conversationId: string;
  userId: string | null;
  userName: string | null;
  userImage: string | null;
  body: string;
  replyToId: string | null;
  editedAt: Date | null;
  createdAt: Date;
};

// Delivered to each member's user stream as the event name.
type ChatEventType =
  | "CHAT_MESSAGE"
  | "CHAT_MESSAGE_CHANGED"
  | "CHAT_MESSAGE_DELETED"
  | "CHAT_UPDATED"
  | "CHAT_READ"
  | "CHAT_TYPING";

// ----------------------------------------------------------------- access

async function findConversation(workspaceId: string, conversationId: string) {
  const [conversation] = await db
    .select()
    .from(chatConversationTable)
    .where(
      and(
        eq(chatConversationTable.id, conversationId),
        eq(chatConversationTable.workspaceId, workspaceId),
      ),
    );
  if (!conversation) {
    throw new HTTPException(404, { message: "Conversation not found" });
  }
  return conversation;
}

async function isMember(conversationId: string, userId: string) {
  const [row] = await db
    .select({ userId: chatMemberTable.userId })
    .from(chatMemberTable)
    .where(
      and(
        eq(chatMemberTable.conversationId, conversationId),
        eq(chatMemberTable.userId, userId),
      ),
    );
  return Boolean(row);
}

function isOpenChannel(conversation: Conversation) {
  return conversation.type === "channel" && !conversation.isPrivate;
}

/** Open channels can be read by anyone in the workspace; the rest by members. */
async function assertCanRead(
  workspaceId: string,
  conversationId: string,
  userId: string,
) {
  const conversation = await findConversation(workspaceId, conversationId);
  if (isOpenChannel(conversation)) return conversation;
  if (!(await isMember(conversationId, userId))) {
    // A 404 keeps private channels and DMs from being probed by id.
    throw new HTTPException(404, { message: "Conversation not found" });
  }
  return conversation;
}

async function assertMember(
  workspaceId: string,
  conversationId: string,
  userId: string,
) {
  const conversation = await assertCanRead(workspaceId, conversationId, userId);
  if (!(await isMember(conversationId, userId))) {
    throw new HTTPException(403, { message: "Join the channel first" });
  }
  return conversation;
}

/** Everyone listed must belong to the workspace. */
async function assertWorkspaceMembers(workspaceId: string, userIds: string[]) {
  if (userIds.length === 0) return;
  const rows = await db
    .select({ userId: workspaceUserTable.userId })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        inArray(workspaceUserTable.userId, userIds),
      ),
    );
  if (new Set(rows.map((r) => r.userId)).size !== new Set(userIds).size) {
    throw new HTTPException(400, {
      message: "Everyone must be a member of the workspace",
    });
  }
}

async function memberIds(conversationId: string) {
  const rows = await db
    .select({ userId: chatMemberTable.userId })
    .from(chatMemberTable)
    .where(eq(chatMemberTable.conversationId, conversationId));
  return rows.map((r) => r.userId);
}

async function notify(
  conversation: Conversation,
  type: ChatEventType,
  extra: Record<string, unknown> = {},
  options: { exclude?: string } = {},
) {
  const recipients = await memberIds(conversation.id);
  await publishEvent("chat.changed", {
    ...extra,
    type,
    workspaceId: conversation.workspaceId,
    conversationId: conversation.id,
    recipientIds: recipients.filter((id) => id !== options.exclude),
  });
}

// ---------------------------------------------------------- conversations

export async function listConversations(workspaceId: string, userId: string) {
  const mine = db
    .select({ id: chatMemberTable.conversationId })
    .from(chatMemberTable)
    .where(eq(chatMemberTable.userId, userId));

  const conversations = await db
    .select()
    .from(chatConversationTable)
    .where(
      and(
        eq(chatConversationTable.workspaceId, workspaceId),
        or(
          inArray(chatConversationTable.id, mine),
          and(
            eq(chatConversationTable.type, "channel"),
            eq(chatConversationTable.isPrivate, false),
          ),
        ),
      ),
    )
    .orderBy(
      desc(
        sql`coalesce(${chatConversationTable.lastMessageAt}, ${chatConversationTable.createdAt})`,
      ),
    );

  const ids = conversations.map((c) => c.id);
  if (ids.length === 0) return [];

  const [members, unread, latest] = await Promise.all([
    db
      .select({
        conversationId: chatMemberTable.conversationId,
        userId: chatMemberTable.userId,
        name: userTable.name,
        image: userTable.image,
        lastReadAt: chatMemberTable.lastReadAt,
      })
      .from(chatMemberTable)
      .innerJoin(userTable, eq(chatMemberTable.userId, userTable.id))
      .where(inArray(chatMemberTable.conversationId, ids)),
    db
      .select({
        conversationId: chatMemberTable.conversationId,
        count: count(),
      })
      .from(chatMemberTable)
      .innerJoin(
        chatMessageTable,
        and(
          eq(chatMessageTable.conversationId, chatMemberTable.conversationId),
          gt(chatMessageTable.createdAt, chatMemberTable.lastReadAt),
          or(
            isNull(chatMessageTable.userId),
            ne(chatMessageTable.userId, userId),
          ),
        ),
      )
      .where(
        and(
          eq(chatMemberTable.userId, userId),
          inArray(chatMemberTable.conversationId, ids),
        ),
      )
      .groupBy(chatMemberTable.conversationId),
    db
      .selectDistinctOn([chatMessageTable.conversationId], {
        conversationId: chatMessageTable.conversationId,
        body: chatMessageTable.body,
        userName: userTable.name,
        createdAt: chatMessageTable.createdAt,
      })
      .from(chatMessageTable)
      .leftJoin(userTable, eq(chatMessageTable.userId, userTable.id))
      .where(inArray(chatMessageTable.conversationId, ids))
      .orderBy(
        chatMessageTable.conversationId,
        desc(chatMessageTable.createdAt),
      ),
  ]);

  const unreadBy = new Map(unread.map((u) => [u.conversationId, u.count]));
  const latestBy = new Map(latest.map((l) => [l.conversationId, l]));

  return conversations.map((c) => {
    const people = members
      .filter((m) => m.conversationId === c.id)
      .map(({ userId: id, name, image, lastReadAt }) => ({
        id,
        name,
        image,
        lastReadAt,
      }));
    const joined = people.some((p) => p.id === userId);
    const last = latestBy.get(c.id);
    return {
      id: c.id,
      type: c.type as "channel" | "dm",
      name: c.name,
      isPrivate: c.isPrivate,
      createdBy: c.createdBy,
      joined,
      members: people,
      unreadCount: joined ? (unreadBy.get(c.id) ?? 0) : 0,
      lastMessage: last
        ? {
            body: last.body,
            userName: last.userName,
            createdAt: last.createdAt,
          }
        : null,
      createdAt: c.createdAt,
    };
  });
}

export async function createChannel(
  workspaceId: string,
  userId: string,
  input: { name: string; isPrivate: boolean; memberIds: string[] },
) {
  const name = input.name.trim().replace(/^#/, "").trim();
  if (!name) throw new HTTPException(400, { message: "Name the channel" });

  const [taken] = await db
    .select({ id: chatConversationTable.id })
    .from(chatConversationTable)
    .where(
      and(
        eq(chatConversationTable.workspaceId, workspaceId),
        eq(chatConversationTable.type, "channel"),
        sql`lower(${chatConversationTable.name}) = lower(${name})`,
      ),
    );
  if (taken) {
    throw new HTTPException(409, {
      message: "A channel with that name already exists",
    });
  }

  const people = [...new Set([userId, ...input.memberIds])];
  await assertWorkspaceMembers(
    workspaceId,
    people.filter((id) => id !== userId),
  );

  const conversation = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(chatConversationTable)
      .values({
        workspaceId,
        type: "channel",
        name,
        isPrivate: input.isPrivate,
        createdBy: userId,
      })
      .returning();
    if (!created) throw new HTTPException(500, { message: "Not created" });
    await tx
      .insert(chatMemberTable)
      .values(people.map((id) => ({ conversationId: created.id, userId: id })));
    return created;
  });

  await notify(conversation, "CHAT_UPDATED");
  return { id: conversation.id };
}

/** Finds or creates the DM between the caller and `otherIds`. */
export async function openDirectMessage(
  workspaceId: string,
  userId: string,
  otherIds: string[],
) {
  const people = [...new Set([userId, ...otherIds])].sort();
  await assertWorkspaceMembers(
    workspaceId,
    people.filter((id) => id !== userId),
  );
  const dmKey = people.join(":");

  const existing = async () => {
    const [row] = await db
      .select({ id: chatConversationTable.id })
      .from(chatConversationTable)
      .where(
        and(
          eq(chatConversationTable.workspaceId, workspaceId),
          eq(chatConversationTable.dmKey, dmKey),
        ),
      );
    return row;
  };

  const found = await existing();
  if (found) return { id: found.id };

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(chatConversationTable)
      .values({
        workspaceId,
        type: "dm",
        isPrivate: true,
        dmKey,
        createdBy: userId,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) return null;
    await tx
      .insert(chatMemberTable)
      .values(people.map((id) => ({ conversationId: row.id, userId: id })));
    return row;
  });

  // Lost a race with the other person opening the same DM.
  if (!created) {
    const raced = await existing();
    if (!raced) throw new HTTPException(500, { message: "Not created" });
    return { id: raced.id };
  }
  return { id: created.id };
}

export async function joinChannel(
  workspaceId: string,
  conversationId: string,
  userId: string,
) {
  const conversation = await findConversation(workspaceId, conversationId);
  if (!isOpenChannel(conversation)) {
    throw new HTTPException(403, {
      message: "Ask someone in the channel to add you",
    });
  }
  await db
    .insert(chatMemberTable)
    .values({ conversationId, userId })
    .onConflictDoNothing();
  await notify(conversation, "CHAT_UPDATED");
  return { id: conversationId };
}

export async function leaveChannel(
  workspaceId: string,
  conversationId: string,
  userId: string,
) {
  const conversation = await findConversation(workspaceId, conversationId);
  if (conversation.type !== "channel") {
    throw new HTTPException(400, { message: "Only channels can be left" });
  }
  await db
    .delete(chatMemberTable)
    .where(
      and(
        eq(chatMemberTable.conversationId, conversationId),
        eq(chatMemberTable.userId, userId),
      ),
    );
  await notify(conversation, "CHAT_UPDATED");
  // The leaver is no longer a recipient, so tell them directly.
  await publishEvent("chat.changed", {
    type: "CHAT_UPDATED",
    workspaceId,
    conversationId,
    recipientIds: [userId],
  });
  return { id: conversationId };
}

export async function addChannelMembers(
  workspaceId: string,
  conversationId: string,
  userId: string,
  userIds: string[],
) {
  const conversation = await assertMember(workspaceId, conversationId, userId);
  if (conversation.type !== "channel") {
    throw new HTTPException(400, {
      message: "Start a new conversation to add people to a direct message",
    });
  }
  await assertWorkspaceMembers(workspaceId, userIds);
  if (userIds.length > 0) {
    await db
      .insert(chatMemberTable)
      .values(userIds.map((id) => ({ conversationId, userId: id })))
      .onConflictDoNothing();
  }
  await notify(conversation, "CHAT_UPDATED");
  return { id: conversationId };
}

export async function deleteChannel(
  workspaceId: string,
  conversationId: string,
  userId: string,
  canManageWorkspace: boolean,
) {
  const conversation = await findConversation(workspaceId, conversationId);
  if (conversation.type !== "channel") {
    throw new HTTPException(400, { message: "Only channels can be deleted" });
  }
  if (conversation.createdBy !== userId && !canManageWorkspace) {
    throw new HTTPException(403, {
      message: "Only whoever created the channel can delete it",
    });
  }
  const recipients = await memberIds(conversationId);
  await db
    .delete(chatConversationTable)
    .where(eq(chatConversationTable.id, conversationId));
  await publishEvent("chat.changed", {
    type: "CHAT_UPDATED",
    workspaceId,
    conversationId,
    recipientIds: recipients,
  });
  return { id: conversationId };
}

// --------------------------------------------------------------- messages

/** Adds the quoted message and grouped reactions to each row. */
async function hydrate(rows: MessageRow[]) {
  const ids = rows.map((r) => r.id);
  const replyIds = [
    ...new Set(
      rows.map((r) => r.replyToId).filter((id): id is string => id !== null),
    ),
  ];
  const [quoted, reactions] = await Promise.all([
    replyIds.length > 0
      ? db
          .select({
            id: chatMessageTable.id,
            body: chatMessageTable.body,
            userName: userTable.name,
          })
          .from(chatMessageTable)
          .leftJoin(userTable, eq(chatMessageTable.userId, userTable.id))
          .where(inArray(chatMessageTable.id, replyIds))
      : [],
    ids.length > 0
      ? db
          .select({
            messageId: chatReactionTable.messageId,
            emoji: chatReactionTable.emoji,
            userId: chatReactionTable.userId,
          })
          .from(chatReactionTable)
          .where(inArray(chatReactionTable.messageId, ids))
          .orderBy(chatReactionTable.createdAt)
      : [],
  ]);
  const quotedBy = new Map(quoted.map((q) => [q.id, q]));

  return rows.map(({ replyToId, ...row }) => {
    const grouped = new Map<string, string[]>();
    for (const r of reactions) {
      if (r.messageId !== row.id) continue;
      grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r.userId]);
    }
    return {
      ...row,
      replyTo: replyToId ? (quotedBy.get(replyToId) ?? null) : null,
      reactions: [...grouped].map(([emoji, userIds]) => ({ emoji, userIds })),
    };
  });
}

export type ChatMessage = Awaited<ReturnType<typeof hydrate>>[number];

async function findMessage(messageId: string) {
  const rows = await db
    .select(messageColumns)
    .from(chatMessageTable)
    .leftJoin(userTable, eq(chatMessageTable.userId, userTable.id))
    .where(eq(chatMessageTable.id, messageId));
  const [message] = await hydrate(rows);
  if (!message) throw new HTTPException(404, { message: "Message not found" });
  return message;
}

export async function listMessages(
  workspaceId: string,
  conversationId: string,
  userId: string,
  options: { before?: string; limit: number },
) {
  await assertCanRead(workspaceId, conversationId, userId);

  const before = options.before
    ? await db
        .select({ createdAt: chatMessageTable.createdAt })
        .from(chatMessageTable)
        .where(
          and(
            eq(chatMessageTable.id, options.before),
            eq(chatMessageTable.conversationId, conversationId),
          ),
        )
        .then((rows) => rows[0]?.createdAt)
    : undefined;

  const rows = await db
    .select(messageColumns)
    .from(chatMessageTable)
    .leftJoin(userTable, eq(chatMessageTable.userId, userTable.id))
    .where(
      and(
        eq(chatMessageTable.conversationId, conversationId),
        before ? lt(chatMessageTable.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(chatMessageTable.createdAt), desc(chatMessageTable.id))
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  return {
    messages: await hydrate(rows.slice(0, options.limit).reverse()),
    hasMore,
  };
}

export async function sendMessage(
  workspaceId: string,
  conversationId: string,
  userId: string,
  body: string,
  replyToId?: string,
) {
  const conversation = await assertMember(workspaceId, conversationId, userId);
  if (replyToId) {
    const [target] = await db
      .select({ id: chatMessageTable.id })
      .from(chatMessageTable)
      .where(
        and(
          eq(chatMessageTable.id, replyToId),
          eq(chatMessageTable.conversationId, conversationId),
        ),
      );
    if (!target) {
      throw new HTTPException(400, {
        message: "Replies must quote a message in the same conversation",
      });
    }
  }
  const now = new Date();

  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(chatMessageTable)
      .values({ conversationId, userId, body, replyToId, createdAt: now })
      .returning({ id: chatMessageTable.id });
    if (!row) throw new HTTPException(500, { message: "Not sent" });
    await tx
      .update(chatConversationTable)
      .set({ lastMessageAt: now })
      .where(eq(chatConversationTable.id, conversationId));
    await tx
      .update(chatMemberTable)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(chatMemberTable.conversationId, conversationId),
          eq(chatMemberTable.userId, userId),
        ),
      );
    return row.id;
  });

  const message = await findMessage(id);
  await notify(conversation, "CHAT_MESSAGE", { message });
  return message;
}

async function messageInWorkspace(workspaceId: string, messageId: string) {
  const [row] = await db
    .select({
      userId: chatMessageTable.userId,
      conversationId: chatMessageTable.conversationId,
    })
    .from(chatMessageTable)
    .innerJoin(
      chatConversationTable,
      eq(chatMessageTable.conversationId, chatConversationTable.id),
    )
    .where(
      and(
        eq(chatMessageTable.id, messageId),
        eq(chatConversationTable.workspaceId, workspaceId),
      ),
    );
  if (!row) throw new HTTPException(404, { message: "Message not found" });
  return row;
}

async function ownMessage(
  workspaceId: string,
  messageId: string,
  userId: string,
) {
  const row = await messageInWorkspace(workspaceId, messageId);
  if (row.userId !== userId) {
    throw new HTTPException(403, { message: "Not your message" });
  }
  return assertMember(workspaceId, row.conversationId, userId);
}

export async function editMessage(
  workspaceId: string,
  messageId: string,
  userId: string,
  body: string,
) {
  const conversation = await ownMessage(workspaceId, messageId, userId);
  await db
    .update(chatMessageTable)
    .set({ body, editedAt: new Date() })
    .where(eq(chatMessageTable.id, messageId));
  const message = await findMessage(messageId);
  await notify(conversation, "CHAT_MESSAGE_CHANGED", { message });
  return message;
}

export async function deleteMessage(
  workspaceId: string,
  messageId: string,
  userId: string,
) {
  const conversation = await ownMessage(workspaceId, messageId, userId);
  await db.delete(chatMessageTable).where(eq(chatMessageTable.id, messageId));
  await notify(conversation, "CHAT_MESSAGE_DELETED", { messageId });
  return { id: messageId };
}

/** Adds the caller's reaction, or takes it back if it's already there. */
export async function toggleReaction(
  workspaceId: string,
  messageId: string,
  userId: string,
  emoji: string,
) {
  const row = await messageInWorkspace(workspaceId, messageId);
  const conversation = await assertMember(
    workspaceId,
    row.conversationId,
    userId,
  );
  const removed = await db
    .delete(chatReactionTable)
    .where(
      and(
        eq(chatReactionTable.messageId, messageId),
        eq(chatReactionTable.userId, userId),
        eq(chatReactionTable.emoji, emoji),
      ),
    )
    .returning({ emoji: chatReactionTable.emoji });
  if (removed.length === 0) {
    await db
      .insert(chatReactionTable)
      .values({ messageId, userId, emoji })
      .onConflictDoNothing();
  }
  const message = await findMessage(messageId);
  await notify(conversation, "CHAT_MESSAGE_CHANGED", { message });
  return message;
}

export async function markRead(
  workspaceId: string,
  conversationId: string,
  userId: string,
) {
  const conversation = await assertCanRead(workspaceId, conversationId, userId);
  const readAt = new Date();
  const updated = await db
    .update(chatMemberTable)
    .set({ lastReadAt: readAt })
    .where(
      and(
        eq(chatMemberTable.conversationId, conversationId),
        eq(chatMemberTable.userId, userId),
      ),
    )
    .returning({ userId: chatMemberTable.userId });
  // Lets the others show "Seen" under their messages.
  if (updated.length > 0) {
    await notify(conversation, "CHAT_READ", { userId, lastReadAt: readAt });
  }
  return { id: conversationId };
}

/** Tells the others someone is typing; clients let it lapse on their own. */
export async function typing(
  workspaceId: string,
  conversationId: string,
  userId: string,
  userName: string,
) {
  const conversation = await assertMember(workspaceId, conversationId, userId);
  await notify(
    conversation,
    "CHAT_TYPING",
    { userId, userName },
    { exclude: userId },
  );
  return { id: conversationId };
}
