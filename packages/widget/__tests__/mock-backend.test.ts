import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createMockBackend,
  type WidgetSnapshot,
} from "../stories/mock-backend.js";

const seed: WidgetSnapshot = {
  activities: [],
  conversations: [],
  articles: [],
  updates: [
    {
      id: "u",
      title: "Update",
      body: "Body",
      author: "Team",
      date: "Nov 9",
      unread: true,
    },
  ],
  feedback: [{ id: "p", title: "Idea", body: "Body", author: "Ada", votes: 1 }],
};
afterEach(() => vi.useRealTimers());
describe("mock service contracts", () => {
  it("deduplicates a retry after commit with a lost response and rejects a changed payload", async () => {
    const backend = createMockBackend(seed, 0);
    const signal = new AbortController().signal;
    backend.failNext("after");
    await expect(
      backend.send("a", "Hello", { idempotencyKey: "key" }, signal),
    ).rejects.toThrow("response lost");
    const data = await backend.send(
      "a",
      "Hello",
      { idempotencyKey: "key" },
      signal,
    );
    expect(data.conversations).toHaveLength(1);
    await expect(
      backend.send("a", "Different", { idempotencyKey: "key" }, signal),
    ).rejects.toThrow("different content");
    expect((await backend.load("b", signal)).conversations).toHaveLength(0);
    await expect(
      backend.reply(
        "b",
        data.conversations[0].id,
        "Private",
        { idempotencyKey: "reply" },
        signal,
      ),
    ).rejects.toThrow("not found");
  });
  it("keeps vote/follow changes idempotent and visitor state separate", async () => {
    const backend = createMockBackend(seed, 0);
    const signal = new AbortController().signal;
    await backend.vote("a", "p", true, signal);
    const data = await backend.vote("a", "p", true, signal);
    expect(data.feedback[0].votes).toBe(2);
    expect(data.feedback[0].voted).toBe(true);
    await backend.follow("a", "p", true, signal);
    const other = await backend.load("b", signal);
    expect(other.feedback[0].voted).toBe(false);
    expect(other.feedback[0].following).toBe(false);
    expect(
      (await backend.vote("a", "p", false, signal)).feedback[0].votes,
    ).toBe(1);
    expect(
      (await backend.follow("a", "p", false, signal)).feedback[0].following,
    ).toBe(false);
  });
  it("uses a monotonic read watermark so later replies remain unread", async () => {
    const backend = createMockBackend(seed, 0);
    const signal = new AbortController().signal;
    const first = await backend.send(
      "a",
      "Question",
      { idempotencyKey: "key" },
      signal,
    );
    const conversation = first.conversations[0];
    const second = await backend.teamReply("a", signal);
    const secondId = second.conversations[0].messages[1].id;
    const pending = await backend.readConversation(
      "a",
      conversation.id,
      conversation.messages[0].id,
      signal,
    );
    expect(pending.conversations[0].unreadCount).toBe(1);
    await backend.readConversation("a", conversation.id, secondId, signal);
    expect(
      (
        await backend.readConversation(
          "a",
          conversation.id,
          conversation.messages[0].id,
          signal,
        )
      ).conversations[0].unreadCount,
    ).toBe(0);
  });
  it("keeps update read markers private and rejects offline writes", async () => {
    const backend = createMockBackend(seed, 0);
    const signal = new AbortController().signal;
    expect((await backend.readUpdate("a", "u", signal)).updates[0].unread).toBe(
      false,
    );
    expect((await backend.load("b", signal)).updates[0].unread).toBe(true);
    backend.setOnline(false);
    await expect(
      backend.send("a", "Offline", { idempotencyKey: "key" }, signal),
    ).rejects.toThrow("Offline");
    backend.setOnline(true);
    expect((await backend.load("a", signal)).conversations).toHaveLength(0);
  });
  it("cancels owned timers and prevents mutation after cancellation", async () => {
    vi.useFakeTimers();
    const backend = createMockBackend(seed, 1000);
    const controller = new AbortController();
    const pending = backend.send(
      "a",
      "Cancelled",
      { idempotencyKey: "key" },
      controller.signal,
    );
    const rejected = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    const loaded = backend.load("a", new AbortController().signal);
    await vi.runAllTimersAsync();
    expect((await loaded).conversations).toHaveLength(0);
  });
});

it("validates comment parents, deduplicates replies and isolates comment votes", async () => {
  const backend = createMockBackend(seed, 0),
    signal = new AbortController().signal;
  const first = await backend.comment(
    "a",
    "p",
    "Question",
    { idempotencyKey: "root" },
    signal,
  );
  const root = first.feedback[0].comments![0];
  backend.failNext("after");
  const options = { idempotencyKey: "reply", parentId: root.id };
  await expect(
    backend.comment("b", "p", "Answer", options, signal),
  ).rejects.toThrow("response lost");
  const result = await backend.comment("b", "p", "Answer", options, signal);
  expect(result.feedback[0].comments).toHaveLength(2);
  await expect(
    backend.comment(
      "a",
      "p",
      "Wrong parent",
      { idempotencyKey: "bad", parentId: "foreign" },
      signal,
    ),
  ).rejects.toThrow("Parent comment not found");
  await backend.voteComment("a", "p", root.id, true, signal);
  expect(
    (await backend.voteComment("a", "p", root.id, true, signal)).feedback[0]
      .comments![0].votes,
  ).toBe(1);
  expect((await backend.load("b", signal)).feedback[0].comments![0].voted).toBe(
    false,
  );
  expect(
    (await backend.voteComment("a", "p", root.id, false, signal)).feedback[0]
      .comments![0].votes,
  ).toBe(0);
});
