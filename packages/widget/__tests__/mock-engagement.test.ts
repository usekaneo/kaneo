import { expect, it } from "vite-plus/test";
import { createMockBackend, emptySnapshot } from "../stories/mock-backend.js";
const seed = {
  ...emptySnapshot,
  feedback: [
    {
      id: "p",
      title: "Request",
      body: "Description",
      author: "Visitor",
      votes: 0,
    },
  ],
  articles: [
    { id: "a", title: "Help", body: "Details", category: "Start" },
    { id: "b", title: "Other help", body: "Details", category: "Start" },
  ],
};
const signal = new AbortController().signal;

it("notifies only followers, suppresses self replies, and deduplicates events on retries", async () => {
  const backend = createMockBackend(seed, 0);
  await backend.follow("a", "p", true, signal);
  await backend.follow("b", "p", true, signal);
  backend.failNext("after");
  const options = { idempotencyKey: "reply" };
  await expect(
    backend.comment("a", "p", "A reply", options, signal),
  ).rejects.toThrow("response lost");
  await backend.comment("a", "p", "A reply", options, signal);
  expect((await backend.load("a", signal)).activities).toHaveLength(0);
  let result = await backend.load("b", signal);
  expect(result.activities).toHaveLength(1);
  expect(result.activities[0]).toMatchObject({
    postId: "p",
    kind: "reply",
    unread: true,
  });
  expect((await backend.load("c", signal)).activities).toHaveLength(0);
  await expect(
    backend.readActivity("a", result.activities[0].id, signal),
  ).rejects.toThrow("not found");
  result = await backend.readActivity("b", result.activities[0].id, signal);
  expect(result.activities[0].unread).toBe(false);
  await backend.requestProgress("a", "p", "planned", signal);
  result = await backend.requestProgress("b", "p", "shipped", signal);
  expect(result.activities.map((item) => item.kind)).toEqual([
    "shipped",
    "status",
    "reply",
  ]);
  expect(result.activities[2].unread).toBe(false);
  await backend.requestProgress("a", "p", "shipped", signal);
  expect((await backend.load("b", signal)).activities).toHaveLength(3);
  await backend.follow("b", "p", false, signal);
  await backend.requestProgress("a", "p", "in_progress", signal);
  expect((await backend.load("b", signal)).activities).toHaveLength(3);
});

it("stores one reversible helpfulness response per visitor and keeps article context in the retry contract", async () => {
  const backend = createMockBackend(seed, 0);
  await backend.articleFeedback("a", "a", true, signal);
  const result = await backend.articleFeedback("a", "a", false, signal);
  expect(result.articles[0].helpful).toBe(false);
  expect((await backend.load("b", signal)).articles[0].helpful).toBeUndefined();
  await expect(
    backend.articleFeedback("a", "unknown", true, signal),
  ).rejects.toThrow("not found");
  backend.failNext("after");
  const options = { idempotencyKey: "question", articleId: "a" };
  await expect(backend.send("a", "Question", options, signal)).rejects.toThrow(
    "response lost",
  );
  const sent = await backend.send("a", "Question", options, signal);
  expect(sent.conversations).toHaveLength(1);
  expect(sent.conversations[0].articleId).toBe("a");
  await expect(
    backend.send("a", "Question", { ...options, articleId: "b" }, signal),
  ).rejects.toThrow("different content");
  await expect(
    backend.send(
      "a",
      "Question",
      { idempotencyKey: "bad", articleId: "missing" },
      signal,
    ),
  ).rejects.toThrow("not found");
});

it("does not mutate engagement after cancellation or while offline", async () => {
  const backend = createMockBackend(seed, 0);
  await backend.follow("a", "p", true, signal);
  const controller = new AbortController();
  const pending = backend.requestProgress(
    "a",
    "p",
    "shipped",
    controller.signal,
  );
  controller.abort();
  await expect(pending).rejects.toHaveProperty("name", "AbortError");
  backend.setOnline(false);
  await expect(backend.articleFeedback("a", "a", true, signal)).rejects.toThrow(
    "Offline",
  );
  backend.setOnline(true);
  const loaded = await backend.load("a", signal);
  expect(loaded.activities).toHaveLength(0);
  expect(loaded.articles[0].helpful).toBeUndefined();
});
