import { it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { createBridge, type Bridge } from "../src/core/postmessage";
const ORIGIN = "https://feedback.acme.com";
let iframe: HTMLIFrameElement;
let bridge: Bridge;
let receive: ReturnType<typeof vi.fn>;
beforeEach(() => {
  iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  bridge = createBridge({ getIframe: () => iframe, origin: ORIGIN });
  receive = vi.fn();
  bridge.onMessage(receive);
});
afterEach(() => {
  bridge.dispose();
  iframe.remove();
  vi.restoreAllMocks();
});
function send(
  data: unknown,
  source: MessageEventSource | null = iframe.contentWindow,
  origin = ORIGIN,
) {
  window.dispatchEvent(new MessageEvent("message", { origin, source, data }));
}
it("sends to the iframe with an explicit target origin", () => {
  const postMessage = vi
    .spyOn(iframe.contentWindow!, "postMessage")
    .mockImplementation(() => {});
  bridge.send("quackback:identify", { anonymous: true });
  expect(postMessage).toHaveBeenCalledWith(
    { type: "quackback:identify", data: { anonymous: true } },
    ORIGIN,
  );
});
it("requires the configured origin and current frame source", () => {
  const other = document.createElement("iframe");
  document.body.appendChild(other);
  send({ type: "quackback:ready" }, other.contentWindow);
  send({ type: "quackback:ready" }, null);
  send(
    { type: "quackback:ready" },
    iframe.contentWindow,
    "https://evil.example",
  );
  expect(receive).not.toHaveBeenCalled();
  const oldWindow = iframe.contentWindow;
  iframe.remove();
  iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  send({ type: "quackback:ready" }, oldWindow);
  expect(receive).not.toHaveBeenCalled();
  send({ type: "quackback:ready" });
  expect(receive).toHaveBeenCalledExactlyOnceWith({ type: "quackback:ready" });
  other.remove();
});
it.each([
  null,
  [],
  "hello",
  {},
  { type: "unknown" },
  { type: "quackback:expand", expanded: "false" },
  ...[Number.NaN, Infinity, -Infinity, -1, 1.5, "5"].map((count) => ({
    type: "quackback:unread",
    count,
  })),
  { type: "quackback:identify-result", success: "yes" },
  { type: "quackback:identify-result", success: true, user: { id: "u1" } },
  {
    type: "quackback:auth-change",
    user: { id: 3, name: "A", email: "a@example.com" },
  },
  { type: "quackback:navigate", url: 42 },
  { type: "quackback:event", name: "constructor", payload: {} },
  {
    type: "quackback:event",
    name: "vote",
    payload: { postId: "p", voted: "yes", voteCount: 0 },
  },
  { type: "quackback:event", name: "unread", payload: { count: Infinity } },
])("ignores malformed messages: %j", (data) => {
  expect(() => send(data)).not.toThrow();
  expect(receive).not.toHaveBeenCalled();
});
it.each([
  { type: "quackback:ready" },
  { type: "quackback:close" },
  { type: "quackback:expand", expanded: false },
  { type: "quackback:navigate", url: "https://example.com" },
  { type: "quackback:unread", count: 0 },
  { type: "quackback:identify-result", success: true, user: null },
  {
    type: "quackback:auth-change",
    user: { id: "u1", name: "A", email: "a@example.com", avatarUrl: null },
  },
  {
    type: "quackback:event",
    name: "vote",
    payload: { postId: "p", voted: true, voteCount: 3 },
  },
  {
    type: "quackback:event",
    name: "post:created",
    payload: {
      id: "p",
      title: "Post",
      board: { id: "b", name: "Board", slug: "board" },
      statusId: null,
    },
  },
])("forwards validated messages: %j", (data) => {
  send(data);
  expect(receive).toHaveBeenCalledExactlyOnceWith(data);
});
it("disposes listeners and isolates subscriber errors", () => {
  bridge.onMessage(() => {
    throw new Error("subscriber");
  });
  const last = vi.fn();
  bridge.onMessage(last);
  send({ type: "quackback:ready" });
  expect(last).toHaveBeenCalledOnce();
  bridge.dispose();
  send({ type: "quackback:ready" });
  expect(last).toHaveBeenCalledOnce();
});
