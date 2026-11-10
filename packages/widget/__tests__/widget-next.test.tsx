import { StrictMode, useState } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  WidgetView,
  type HelpArticle,
  type Conversation,
} from "../src/ui/index.js";
import { AttachmentGallery } from "../src/ui/AttachmentGallery.js";
import { useConversationScroll } from "../src/ui/useConversationScroll.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const articles: HelpArticle[] = [
  {
    id: "a",
    title: "Share feedback",
    body: "Write down your idea.",
    category: "Start",
  },
];
const png = new File(
  [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
  "paste.png",
  { type: "image/png" },
);

it("pastes and drops through the image validator, deduplicates retries, and leaves normal paste alone", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const send = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost"))
    .mockResolvedValue(undefined);
  render(
    <WidgetView onClose={vi.fn()} onSendMessage={send} attachmentsEnabled />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
  const field = screen.getByRole("textbox");
  expect(fireEvent.paste(field, { clipboardData: { files: [] } })).toBe(true);
  expect(fireEvent.paste(field, { clipboardData: { files: [png] } })).toBe(
    false,
  );
  await screen.findByRole("button", { name: "Edit paste.png" });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("alert");
  const options = send.mock.calls[0][1];
  fireEvent.drop(field, { dataTransfer: { types: ["Files"], files: [png] } });
  await waitFor(() =>
    expect(screen.queryByText("Preparing image…")).toBeNull(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Message sent.");
  expect(send).toHaveBeenLastCalledWith("", options);
  expect(options.attachments).toEqual([png]);
});

it("rejects malformed dropped files and ignores a late paste validation after navigation", async () => {
  render(<WidgetView onClose={vi.fn()} attachmentsEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "Submit a request" }));
  fireEvent.drop(screen.getByRole("textbox"), {
    dataTransfer: {
      types: ["Files"],
      files: [new File(["bad"], "bad.png", { type: "image/png" })],
    },
  });
  expect((await screen.findByRole("alert")).textContent).toContain(
    "image format",
  );
  let finish!: (data: ArrayBuffer) => void;
  const delayed = new File([png], "late.png", { type: "image/png" });
  vi.spyOn(delayed, "slice").mockReturnValue({
    arrayBuffer: () =>
      new Promise<ArrayBuffer>((resolve) => {
        finish = resolve;
      }),
  } as Blob);
  fireEvent.paste(screen.getByRole("textbox"), {
    clipboardData: { files: [delayed] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  await act(async () => finish(await png.arrayBuffer()));
  fireEvent.click(screen.getByRole("button", { name: "Submit a request" }));
  expect(screen.queryByRole("button", { name: "Edit late.png" })).toBeNull();
});

it("sends with Command/Control+Enter, keeps Enter for newlines, respects IME and pending state", async () => {
  const send = vi.fn(() => new Promise(() => {}));
  render(<WidgetView onClose={vi.fn()} onSendMessage={send} />);
  fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
  const field = screen.getByRole("textbox");
  fireEvent.change(field, { target: { value: "A message" } });
  expect(fireEvent.keyDown(field, { key: "Enter" })).toBe(true);
  fireEvent.keyDown(field, { key: "Enter", ctrlKey: true, isComposing: true });
  expect(send).not.toHaveBeenCalled();
  fireEvent.keyDown(field, { key: "Enter", metaKey: true });
  fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
  expect(send).toHaveBeenCalledTimes(1);
});

it("keeps article feedback authoritative and separates contextual drafts from an existing message", async () => {
  const vote = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(undefined);
  const send = vi.fn().mockResolvedValue(undefined);
  render(
    <WidgetView
      onClose={vi.fn()}
      articles={articles}
      onArticleFeedback={vote}
      onSendMessage={send}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "My existing draft" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: /Browse help without losing/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Start/ }));
  fireEvent.click(screen.getByRole("button", { name: "Share feedback" }));
  fireEvent.click(screen.getByRole("button", { name: "No" }));
  await screen.findByRole("alert");
  expect(
    screen.getByRole("button", { name: "No" }).getAttribute("aria-pressed"),
  ).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Yes" }));
  await waitFor(() => expect(vote).toHaveBeenLastCalledWith("a", true));
  fireEvent.click(screen.getByRole("button", { name: /Still need help/ }));
  expect(screen.getByText("About: Share feedback")).toBeDefined();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Article question" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Message sent.");
  expect(send).toHaveBeenCalledWith(
    "Article question",
    expect.objectContaining({ articleId: "a" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
    "My existing draft",
  );
});

it("opens the exact request from activity and exposes read failure without hiding unread state", async () => {
  const read = vi.fn().mockRejectedValue(new Error("failed"));
  render(
    <WidgetView
      onClose={vi.fn()}
      onReadActivity={read}
      feedback={[
        {
          id: "p",
          title: "Exact request",
          body: "Details",
          author: "Ada",
          votes: 1,
        },
      ]}
      activities={[
        {
          id: "n",
          postId: "p",
          title: "Exact request",
          summary: "Shipped today.",
          kind: "shipped",
          createdAt: "2026-11-09T12:00:00Z",
          unread: true,
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Activity/ }));
  fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
  await screen.findByRole("alert");
  expect(read).toHaveBeenCalledWith("n");
  expect(screen.getByLabelText("Unread")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: /Exact request/ }));
  expect(screen.getByRole("heading", { name: "Exact request" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("heading", { name: "Activity" })).toBeDefined();
});

it("views only safe images in a modal, navigates, zooms, and restores focus", async () => {
  render(
    <StrictMode>
      <AttachmentGallery
        attachments={[
          { id: "bad", name: "Bad", url: "javascript:alert(1)" },
          { id: "1", name: "One", url: "https://example.test/1.png" },
          { id: "2", name: "Two", url: "https://example.test/2.png" },
        ]}
      />
    </StrictMode>,
  );
  expect(
    screen.queryByRole("button", { name: "Open attachment Bad" }),
  ).toBeNull();
  const trigger = screen.getByRole("button", { name: "Open attachment One" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  fireEvent.keyDown(dialog, { key: "ArrowRight" });
  expect(screen.getByText("2 of 2")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(
    screen
      .getByRole("button", { name: "Fit image" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.keyDown(dialog, { key: "ArrowLeft" });
  expect(screen.getByRole("button", { name: "Zoom in" })).toBeDefined();
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it("recovers an open image viewer when the host renews its failed URL", () => {
  const images = [
    { id: "image", name: "Image", url: "https://example.test/expired.png" },
  ];
  const view = render(<AttachmentGallery attachments={images} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open attachment Image" }),
  );
  const preview = screen.getByRole("dialog").querySelector("img")!;
  fireEvent.error(preview);
  expect(screen.getByRole("alert").textContent).toContain(
    "could not be loaded",
  );
  view.rerender(
    <AttachmentGallery
      attachments={[{ ...images[0], url: "https://example.test/renewed.png" }]}
    />,
  );
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("dialog").querySelector("img")?.src).toBe(
    "https://example.test/renewed.png",
  );
});

it("captures the opening unread divider before synchronous host acknowledgment", () => {
  const read = vi.fn();
  function Host() {
    const [conversation, setConversation] = useState<Conversation>({
      id: "c",
      title: "Unread conversation",
      unreadCount: 2,
      messages: [
        { id: "old", body: "Old", author: "You", fromVisitor: true },
        { id: "first", body: "First unread", author: "Team" },
        { id: "last", body: "Last unread", author: "Team" },
      ],
    });
    return (
      <WidgetView
        onClose={vi.fn()}
        initialTab="messages"
        conversations={[conversation]}
        onReadConversation={async (id, through) => {
          read(id, through);
          setConversation((current) => ({ ...current, unreadCount: 0 }));
        }}
      />
    );
  }
  render(
    <StrictMode>
      <Host />
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole("button", { name: /Unread conversation/ }));
  expect(read).toHaveBeenCalledExactlyOnceWith("c", "last");
  expect(
    screen.getByText("New messages").nextElementSibling?.textContent,
  ).toContain("First unread");
  expect(screen.queryByRole("button", { name: "Mark as read" })).toBeNull();
});

it("keeps keyboard focus in the conversation after Jump to latest disappears", () => {
  const view = render(
    <WidgetView
      onClose={vi.fn()}
      initialTab="messages"
      conversations={[
        {
          id: "c",
          title: "Conversation",
          messages: [{ id: "m", body: "Message", author: "Team" }],
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Conversation/ }));
  const content = view.container.querySelector<HTMLDivElement>(".qb-content")!;
  Object.defineProperties(content, {
    scrollHeight: { value: 2000 },
    clientHeight: { value: 400 },
  });
  content.scrollTop = 100;
  fireEvent.scroll(content);
  const jump = screen.getByRole("button", { name: "Jump to latest" });
  jump.focus();
  fireEvent.click(jump);
  expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();
  expect(document.activeElement).toBe(content);
});

it("preserves reading position on arrival and follows the bottom only when near it", () => {
  const node = document.createElement("div");
  let height = 2000,
    top = 0;
  Object.defineProperties(node, {
    scrollHeight: { get: () => height },
    clientHeight: { value: 400 },
    scrollTop: {
      get: () => top,
      set: (value: number) => {
        top = Math.max(0, Math.min(value, height - 400));
      },
    },
  });
  node.scrollTo = (options: ScrollToOptions | number) => {
    if (typeof options === "object") node.scrollTop = options.top ?? 0;
  };
  const container = { current: node };
  const conversation: Conversation = {
    id: "c",
    title: "Chat",
    unreadCount: 1,
    messages: [
      { id: "a", body: "old", author: "Team" },
      { id: "b", body: "new", author: "Team" },
    ],
  };
  const hook = renderHook(
    ({ chat }) => useConversationScroll(chat, container),
    { initialProps: { chat: conversation } },
  );
  expect(hook.result.current.firstUnread).toBe("b");
  act(() => {
    node.scrollTop = 100;
    fireEvent.scroll(node);
  });
  height = 2400;
  hook.rerender({
    chat: {
      ...conversation,
      unreadCount: 0,
      messages: [
        ...conversation.messages,
        { id: "c", body: "newer", author: "Team" },
      ],
    },
  });
  expect(node.scrollTop).toBe(100);
  expect(hook.result.current.away).toBe(true);
  expect(hook.result.current.firstUnread).toBe("b");
  act(() => hook.result.current.jump());
  expect(node.scrollTop).toBe(2000);
  height = 2600;
  hook.rerender({
    chat: {
      ...conversation,
      messages: [
        ...conversation.messages,
        { id: "d", body: "latest", author: "Team" },
      ],
    },
  });
  expect(node.scrollTop).toBe(2200);
});
