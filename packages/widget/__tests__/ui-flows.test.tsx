import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { WidgetView, type WidgetViewProps } from "../src/ui/index.js";

afterEach(cleanup);
const articles = [
  {
    id: "a",
    category: "Basics",
    title: "Share feedback",
    body: "Start by writing a request.",
  },
  {
    id: "b",
    category: "Basics",
    title: "Follow feedback",
    body: "Follow a request.",
  },
];
const feedback = [
  {
    id: "p",
    title: "A planned idea",
    body: "Details",
    author: "Ada",
    votes: 2,
    status: "planned" as const,
  },
  {
    id: "s",
    title: "A shipped idea",
    body: "Details",
    author: "Ada",
    votes: 5,
    status: "shipped" as const,
  },
];

describe("widget visitor journeys", () => {
  it("retains separate drafts across help, Back, and navigation", () => {
    render(<WidgetView onClose={vi.fn()} articles={articles} />);
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "feedback" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Share feedback" }));
    expect(
      screen.getByRole("heading", { name: "Share feedback" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "feedback",
    );
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit a request" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "An idea" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "feedback",
    );
  });

  it("restores help category, search, list scroll and feedback filters", () => {
    render(
      <WidgetView
        onClose={vi.fn()}
        articles={articles}
        feedback={feedback}
        initialTab="help"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Basics/ }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Share" },
    });
    const content = document.querySelector<HTMLElement>(".qb-content")!;
    content.scrollTop = 120;
    fireEvent.click(screen.getByRole("button", { name: /Share feedback/ }));
    expect(content.scrollTop).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(content.scrollTop).toBe(120);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(
      "Share",
    );
    expect(
      screen.getByRole("button", { name: "All categories" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    fireEvent.click(screen.getByRole("button", { name: "Planned" }));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "votes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    expect(
      screen
        .getByRole("button", { name: "Planned" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "votes",
    );
    expect(screen.queryByRole("button", { name: /A shipped idea/ })).toBeNull();
  });

  it("filters explicit and default open requests together", () => {
    render(
      <WidgetView
        onClose={vi.fn()}
        initialTab="feedback"
        feedback={[
          ...feedback,
          {
            ...feedback[0],
            id: "open",
            title: "Explicit open idea",
            status: "open",
          },
          {
            ...feedback[0],
            id: "default",
            title: "Default open idea",
            status: undefined,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(
      screen.getByRole("button", { name: /Explicit open idea/ }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Default open idea/ }),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /A planned idea|A shipped idea/ }),
    ).toBeNull();
  });

  it("retains a pending operation across Back and retries failures with the same key", async () => {
    let reject!: (error: Error) => void;
    const send = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, fail) => {
            reject = fail;
          }),
      )
      .mockResolvedValue(undefined);
    render(<WidgetView onClose={vi.fn()} onSendMessage={send} />);
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "My draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const key = send.mock.calls[0][1].idempotencyKey;
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).readOnly).toBe(
      true,
    );
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(send).toHaveBeenCalledTimes(1);
    reject(new Error("lost response"));
    await screen.findByRole("alert");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " My draft " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Message sent.");
    expect(send).toHaveBeenLastCalledWith("My draft", { idempotencyKey: key });
  });

  it("rotates an idempotency key when the visitor changes failed content", async () => {
    const send = vi.fn().mockRejectedValue(new Error("offline"));
    render(<WidgetView onClose={vi.fn()} onSendMessage={send} />);
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "First" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("alert");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("alert");
    expect(send.mock.calls[0][1].idempotencyKey).not.toBe(
      send.mock.calls[1][1].idempotencyKey,
    );
  });

  it("clears private drafts and ignores stale completion on a session key change", async () => {
    let finish!: () => void;
    const send = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    const view = render(
      <WidgetView key="visitor-a" onClose={vi.fn()} onSendMessage={send} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Private A" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    view.rerender(
      <WidgetView key="visitor-b" onClose={vi.fn()} onSendMessage={send} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    finish();
    await waitFor(() =>
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
        "",
      ),
    );
    expect(screen.queryByText("Message sent.")).toBeNull();
  });

  it("shows loading and recoverable failure without claiming an empty list", async () => {
    const retry = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const view = render(<WidgetView onClose={vi.fn()} loadState="loading" />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(screen.queryByText("No conversations yet")).toBeNull();
    view.rerender(
      <WidgetView onClose={vi.fn()} loadState="error" onRetryLoad={retry} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(retry).toHaveBeenCalledTimes(2);
  });

  it("keeps the offline draft editable and only sends after reconnection", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <WidgetView
        onClose={vi.fn()}
        connection="offline"
        onSendMessage={send}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Offline draft" },
    });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(send).not.toHaveBeenCalled();
    view.rerender(
      <WidgetView onClose={vi.fn()} connection="online" onSendMessage={send} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Message sent.");
  });

  it("sets desired vote/follow states, locks duplicate actions, and allows reversal", async () => {
    let finish!: () => void;
    const vote = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const follow = vi.fn().mockResolvedValue(undefined);
    const props: WidgetViewProps = {
      initialTab: "feedback",
      onClose: vi.fn(),
      feedback,
      onVoteFeedback: vote,
      onFollowFeedback: follow,
    };
    const view = render(<WidgetView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /A planned idea/ }));
    fireEvent.click(screen.getByRole("button", { name: "Vote · 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Vote · 2" }));
    expect(vote).toHaveBeenCalledExactlyOnceWith("p", true);
    finish();
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Follow request",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    view.rerender(
      <WidgetView
        {...props}
        feedback={[{ ...feedback[0], voted: true, votes: 3, following: true }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Voted · 3" }));
    expect(vote).toHaveBeenLastCalledWith("p", false);
    finish();
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Following" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Following" }));
    expect(follow).toHaveBeenCalledExactlyOnceWith("p", false);
  });

  it("opens unread conversations from Home, acknowledges through a message, and replies", async () => {
    const read = vi.fn().mockResolvedValue(undefined);
    const reply = vi.fn().mockResolvedValue(undefined);
    render(
      <WidgetView
        onClose={vi.fn()}
        conversations={[
          {
            id: "c",
            title: "A question",
            unreadCount: 1,
            messages: [
              {
                id: "m",
                author: "Team",
                body: "Hello",
                sentAt: "2026-11-09T10:00:00Z",
              },
            ],
          },
        ]}
        onReadConversation={read}
        onReplyMessage={reply}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /You have a new reply/ }),
    );
    expect(read).toHaveBeenCalledExactlyOnceWith("c", "m");
    expect(document.querySelector("time")?.dateTime).toBe(
      "2026-11-09T10:00:00.000Z",
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Your reply" }), {
      target: { value: "Thanks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() =>
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
        "",
      ),
    );
    expect(reply).toHaveBeenCalledExactlyOnceWith("c", "Thanks", {
      idempotencyKey: expect.any(String),
    });
  });

  it("keeps unread acknowledgments independent when switching items during a request", async () => {
    let rejectA!: (error: Error) => void;
    let finishB!: () => void;
    const read = vi.fn(
      (id: string) =>
        new Promise<void>((resolve, reject) => {
          if (id === "a") rejectA = reject;
          else finishB = resolve;
        }),
    );
    render(
      <WidgetView
        onClose={vi.fn()}
        initialTab="messages"
        conversations={["a", "b"].map((id) => ({
          id,
          title: `Thread ${id}`,
          unreadCount: 1,
          messages: [{ id: `message-${id}`, body: "Reply", author: "Team" }],
        }))}
        onReadConversation={read}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Thread a/ }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: /Thread b/ }));
    expect(read.mock.calls).toEqual([
      ["a", "message-a"],
      ["b", "message-b"],
    ]);
    rejectA(new Error("First item failed"));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("heading", { name: "Thread b" })).toBeDefined();
    expect(
      (
        screen.getByRole("button", {
          name: "Marking as read…",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    finishB();
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Mark as read",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders structured articles as text, with related article navigation", () => {
    render(
      <WidgetView
        onClose={vi.fn()}
        initialTab="help"
        articles={[
          {
            ...articles[0],
            blocks: [
              { type: "heading", text: "Steps" },
              { type: "list", items: ["First", "Second"], ordered: true },
              { type: "code", text: "<script>bad()</script>" },
            ],
          },
          articles[1],
        ]}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Share" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Share feedback/ }));
    expect(screen.getByRole("heading", { name: "Steps" })).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(document.querySelector("script")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Follow feedback" }));
    expect(
      screen.getByRole("heading", { name: "Follow feedback" }),
    ).toBeDefined();
  });
});
