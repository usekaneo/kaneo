import { MAX_ATTACHMENTS, validateImage } from "../src/ui/media.js";
import { feedbackStatusLabels } from "../src/ui/feedback.js";
import type {
  Attachment,
  RequestActivity,
  FeedbackStatus,
  Conversation,
  FeedbackPost,
  HelpArticle,
  SubmissionOptions,
  UpdateEntry,
} from "../src/ui/index.js";

export interface WidgetSnapshot {
  activities: RequestActivity[];
  conversations: Conversation[];
  feedback: FeedbackPost[];
  articles: HelpArticle[];
  updates: UpdateEntry[];
}
export const emptySnapshot: WidgetSnapshot = {
  activities: [],
  conversations: [],
  feedback: [],
  articles: [],
  updates: [],
};

/** In-memory demo service. No HTTP, browser storage, analytics, or production credentials. */
export function createMockBackend(
  seed: Omit<WidgetSnapshot, "activities">,
  latency = 250,
) {
  const data = structuredClone(seed);
  const objectUrls = new Set<string>();
  const visitors = new Map<
    string,
    {
      conversations: Conversation[];
      activities: RequestActivity[];
      helpful: Map<string, boolean>;
      votes: Set<string>;
      commentVotes: Set<string>;
      follows: Set<string>;
      readUpdates: Set<string>;
      reactions: Set<string>;
      readThrough: Map<string, number>;
    }
  >();
  const receipts = new Map<string, string>();
  let online = true;
  let nextFailure: "none" | "before" | "after" = "none";
  const visitor = (id: string) => {
    let state = visitors.get(id);
    if (!state) {
      state = {
        conversations: structuredClone(seed.conversations),
        activities: [],
        helpful: new Map(),
        votes: new Set(),
        commentVotes: new Set(),
        follows: new Set(),
        readUpdates: new Set(),
        reactions: new Set(),
        readThrough: new Map(),
      };
      visitors.set(id, state);
    }
    return state;
  };
  const snapshot = (id: string): WidgetSnapshot => {
    const state = visitor(id);
    return structuredClone({
      ...data,
      conversations: state.conversations,
      activities: state.activities,
      articles: data.articles.map((article) => ({
        ...article,
        helpful: state.helpful.get(article.id),
      })),
      feedback: data.feedback.map((post) => ({
        ...post,
        voted: state.votes.has(post.id),
        following: state.follows.has(post.id),
        comments: post.comments?.map((comment) => ({
          ...comment,
          voted: state.commentVotes.has(JSON.stringify([post.id, comment.id])),
        })),
      })),
      updates: data.updates.map((entry) => ({
        ...entry,
        unread: !!entry.unread && !state.readUpdates.has(entry.id),
        reactions: entry.reactions?.map((reaction) => ({
          ...reaction,
          reacted: state.reactions.has(`${entry.id}:${reaction.emoji}`),
        })),
      })),
    });
  };
  const wait = async (signal: AbortSignal) => {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (!online) throw new Error("Offline");
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, latency);
      signal.addEventListener("abort", abort, { once: true });
    });
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    if (!online) throw new Error("Offline");
  };
  const submit = async (
    id: string,
    scope: string,
    body: string,
    options: SubmissionOptions,
    signal: AbortSignal,
    save: (attachments: Attachment[]) => void,
  ) => {
    await wait(signal);
    const files = options.attachments ?? [];
    if (files.length > MAX_ATTACHMENTS) throw new Error("Too many attachments");
    await Promise.all(files.map(validateImage));
    const hashes = await Promise.all(
      files.map(async (file) =>
        Array.from(
          new Uint8Array(
            await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
          ),
        ).join(","),
      ),
    );
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const payload = JSON.stringify([
      body,
      options.articleId,
      files.map((file, index) => [file.name, file.type, hashes[index]]),
    ]);
    const key = JSON.stringify([id, scope, options.idempotencyKey]);
    const saved = receipts.get(key);
    if (saved !== undefined) {
      if (saved !== payload)
        throw new Error("Idempotency key reused with different content");
      return snapshot(id);
    }
    const failure = nextFailure;
    nextFailure = "none";
    if (failure === "before") throw new Error("Demo save failed");
    if (!body.trim() && !files.length) throw new Error("Content is required");
    const attachments: Attachment[] = [];
    try {
      for (const file of files)
        attachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: URL.createObjectURL(file),
        });
      save(attachments);
      attachments.forEach((item) => objectUrls.add(item.url));
    } catch (error) {
      attachments.forEach((item) => URL.revokeObjectURL(item.url));
      throw error;
    }
    receipts.set(key, payload);
    if (failure === "after") throw new Error("Demo response lost after saving");
    return snapshot(id);
  };
  const notifyFollowers = (
    post: FeedbackPost,
    kind: RequestActivity["kind"],
    summary: string,
    actor?: string,
  ) => {
    for (const [id, state] of visitors) {
      if (id !== actor && state.follows.has(post.id))
        state.activities.unshift({
          id: crypto.randomUUID(),
          postId: post.id,
          title: post.title,
          kind,
          summary,
          createdAt: new Date().toISOString(),
          unread: true,
        });
    }
  };
  return {
    async readActivity(id: string, activityId: string, signal: AbortSignal) {
      await wait(signal);
      const activity = visitor(id).activities.find(
        (item) => item.id === activityId,
      );
      if (!activity) throw new Error("Activity not found");
      activity.unread = false;
      return snapshot(id);
    },
    async articleFeedback(
      id: string,
      articleId: string,
      helpful: boolean,
      signal: AbortSignal,
    ) {
      await wait(signal);
      if (!data.articles.some((article) => article.id === articleId))
        throw new Error("Article not found");
      visitor(id).helpful.set(articleId, helpful);
      return snapshot(id);
    },
    async requestProgress(
      id: string,
      postId: string,
      status: FeedbackStatus,
      signal: AbortSignal,
    ) {
      await wait(signal);
      const post = data.feedback.find((item) => item.id === postId);
      if (!post) throw new Error("Request not found");
      if (post.status !== status) {
        post.status = status;
        notifyFollowers(
          post,
          status === "shipped" ? "shipped" : "status",
          `Status changed to ${feedbackStatusLabels[status]}.`,
        );
      }
      return snapshot(id);
    },
    dispose() {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    },
    setOnline(value: boolean) {
      online = value;
    },
    failNext(value: "before" | "after") {
      nextFailure = value;
    },
    async load(id: string, signal: AbortSignal) {
      await wait(signal);
      return snapshot(id);
    },
    send(
      id: string,
      body: string,
      options: SubmissionOptions,
      signal: AbortSignal,
    ) {
      return submit(id, "send", body, options, signal, (attachments) => {
        if (
          options.articleId &&
          !data.articles.some((article) => article.id === options.articleId)
        )
          throw new Error("Article not found");
        const messageId = crypto.randomUUID();
        visitor(id).conversations.push({
          id: crypto.randomUUID(),
          title: body || "Image attachment",
          unreadCount: 0,
          articleId: options.articleId,
          messages: [
            {
              id: messageId,
              attachments,
              body,
              author: "You",
              fromVisitor: true,
              sentAt: new Date().toISOString(),
            },
          ],
        });
      });
    },
    reply(
      id: string,
      conversationId: string,
      body: string,
      options: SubmissionOptions,
      signal: AbortSignal,
    ) {
      return submit(
        id,
        `reply:${conversationId}`,
        body,
        options,
        signal,
        (attachments) => {
          const conversation = visitor(id).conversations.find(
            (item) => item.id === conversationId,
          );
          if (!conversation) throw new Error("Conversation not found");
          conversation.messages = [
            ...conversation.messages,
            {
              id: crypto.randomUUID(),
              attachments,
              body,
              author: "You",
              fromVisitor: true,
              sentAt: new Date().toISOString(),
            },
          ];
        },
      );
    },
    feedback(
      id: string,
      body: string,
      options: SubmissionOptions,
      signal: AbortSignal,
    ) {
      return submit(id, "feedback", body, options, signal, (attachments) =>
        data.feedback.unshift({
          id: crypto.randomUUID(),
          title: body || "Image feedback",
          body,
          author: id === "ada" ? "Ada" : "Visitor",
          votes: 0,
          status: "open",
          attachments,
          createdAt: new Date().toISOString(),
        }),
      );
    },
    comment(
      id: string,
      postId: string,
      body: string,
      options: SubmissionOptions & { parentId?: string },
      signal: AbortSignal,
    ) {
      return submit(
        id,
        JSON.stringify(["comment", postId, options.parentId]),
        body,
        options,
        signal,
        () => {
          if (!body.trim() || options.attachments?.length)
            throw new Error("Comments require text");
          const post = data.feedback.find((item) => item.id === postId);
          if (!post) throw new Error("Request not found");
          if (
            options.parentId &&
            !post.comments?.some((comment) => comment.id === options.parentId)
          )
            throw new Error("Parent comment not found");
          post.comments = [
            ...(post.comments ?? []),
            {
              id: crypto.randomUUID(),
              body,
              author: id === "ada" ? "Ada" : "Visitor",
              createdAt: new Date().toISOString(),
              parentId: options.parentId,
              votes: 0,
            },
          ];
          notifyFollowers(
            post,
            "reply",
            `${id === "ada" ? "Ada" : "Visitor"} replied to this request.`,
            id,
          );
        },
      );
    },
    async voteComment(
      id: string,
      postId: string,
      commentId: string,
      voted: boolean,
      signal: AbortSignal,
    ) {
      await wait(signal);
      const comment = data.feedback
        .find((post) => post.id === postId)
        ?.comments?.find((item) => item.id === commentId);
      if (!comment) throw new Error("Comment not found");
      const key = JSON.stringify([postId, commentId]);
      const votes = visitor(id).commentVotes;
      if (votes.has(key) !== voted) {
        comment.votes += voted ? 1 : -1;
        if (voted) votes.add(key);
        else votes.delete(key);
      }
      return snapshot(id);
    },
    async vote(
      id: string,
      postId: string,
      voted: boolean,
      signal: AbortSignal,
    ) {
      await wait(signal);
      const post = data.feedback.find((item) => item.id === postId);
      if (!post) throw new Error("Request not found");
      const votes = visitor(id).votes;
      if (votes.has(postId) !== voted) {
        post.votes += voted ? 1 : -1;
        if (voted) votes.add(postId);
        else votes.delete(postId);
      }
      return snapshot(id);
    },
    async follow(
      id: string,
      postId: string,
      following: boolean,
      signal: AbortSignal,
    ) {
      await wait(signal);
      if (!data.feedback.some((item) => item.id === postId))
        throw new Error("Request not found");
      const follows = visitor(id).follows;
      if (following) follows.add(postId);
      else follows.delete(postId);
      return snapshot(id);
    },
    async readConversation(
      id: string,
      conversationId: string,
      through: string,
      signal: AbortSignal,
    ) {
      await wait(signal);
      const conversation = visitor(id).conversations.find(
        (item) => item.id === conversationId,
      );
      if (!conversation) throw new Error("Conversation not found");
      const index = conversation.messages.findIndex(
        (message) => message.id === through,
      );
      if (index < 0) throw new Error("Message not found");
      const readThrough = visitor(id).readThrough;
      const watermark = Math.max(index, readThrough.get(conversationId) ?? -1);
      readThrough.set(conversationId, watermark);
      conversation.unreadCount = conversation.messages
        .slice(watermark + 1)
        .filter((message) => !message.fromVisitor).length;
      return snapshot(id);
    },
    async readUpdate(id: string, entryId: string, signal: AbortSignal) {
      await wait(signal);
      if (!data.updates.some((entry) => entry.id === entryId))
        throw new Error("Update not found");
      visitor(id).readUpdates.add(entryId);
      return snapshot(id);
    },
    async react(
      id: string,
      entryId: string,
      emoji: string,
      signal: AbortSignal,
    ) {
      await wait(signal);
      const reaction = data.updates
        .find((entry) => entry.id === entryId)
        ?.reactions?.find((item) => item.emoji === emoji);
      if (!reaction) throw new Error("Reaction not found");
      const reactions = visitor(id).reactions;
      const key = `${entryId}:${emoji}`;
      if (reactions.has(key)) {
        reactions.delete(key);
        reaction.count--;
      } else {
        reactions.add(key);
        reaction.count++;
      }
      return snapshot(id);
    },
    async teamReply(id: string, signal: AbortSignal) {
      await wait(signal);
      const conversations = visitor(id).conversations;
      const conversation = conversations[conversations.length - 1];
      if (!conversation) throw new Error("Start a conversation first");
      conversation.messages = [
        ...conversation.messages,
        {
          id: crypto.randomUUID(),
          body: "Thanks for the details. We can help you with that.",
          author: "Quills team",
          fromVisitor: false,
          sentAt: new Date().toISOString(),
        },
      ];
      conversation.unreadCount = (conversation.unreadCount ?? 0) + 1;
      return snapshot(id);
    },
  };
}
export type MockBackend = ReturnType<typeof createMockBackend>;
