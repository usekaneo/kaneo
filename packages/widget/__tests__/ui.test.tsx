import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { WidgetView } from "../src/ui/index.js";

afterEach(cleanup);

describe("widget view", () => {
  it("keeps Quills attribution separate from the host brand and switches Phosphor weights", () => {
    render(<WidgetView brandName="Acme" onClose={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Acme support" })).toBeDefined();
    expect(document.querySelector(".qb-footer")?.textContent).toBe(
      "Powered by Quills",
    );
    const home = screen.getByRole("button", { name: "Home" });
    const messages = screen.getByRole("button", { name: "Messages" });
    expect(home.querySelector("svg")?.getAttribute("viewBox")).toBe(
      "0 0 256 256",
    );
    const selectedHome = home.querySelector("path")?.getAttribute("d");
    const inactiveMessages = messages.querySelector("path")?.getAttribute("d");
    fireEvent.click(messages);
    expect(home.querySelector("path")?.getAttribute("d")).not.toBe(
      selectedHome,
    );
    expect(messages.querySelector("path")?.getAttribute("d")).not.toBe(
      inactiveMessages,
    );
  });
  it("keeps navigation buttons from submitting a host form", () => {
    const submit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <WidgetView onClose={vi.fn()} />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("button", { name: "Close widget" }));
    expect(submit).not.toHaveBeenCalled();
    for (const button of screen.getAllByRole("button"))
      expect((button as HTMLButtonElement).type).toBe("button");
  });

  it("keeps keyboard focus inside the widget through help categories, details, and Back", () => {
    const close = vi.fn();
    render(
      <WidgetView
        initialTab="help"
        onClose={close}
        articles={[
          {
            id: "a",
            category: "Getting started",
            title: "First steps",
            body: "Start here.",
          },
        ]}
      />,
    );
    screen.getByRole("button", { name: /Getting started/ }).focus();
    fireEvent.click(document.activeElement!);
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    screen.getByRole("button", { name: "First steps" }).focus();
    fireEvent.click(document.activeElement!);
    expect(screen.getByRole("region").contains(document.activeElement)).toBe(
      true,
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: "Back" }).focus();
    fireEvent.click(document.activeElement!);
    expect(screen.getByRole("region").contains(document.activeElement)).toBe(
      true,
    );
  });

  it("sorts feedback without changing the supplied array", () => {
    const posts = [
      { id: "a", title: "Zebra", body: "First", author: "Ada", votes: 1 },
      { id: "b", title: "Apple", body: "Second", author: "Ada", votes: 5 },
    ];
    render(
      <WidgetView initialTab="feedback" onClose={vi.fn()} feedback={posts} />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Sort feedback" }), {
      target: { value: "votes" },
    });
    expect(
      document.querySelector(".qb-feedback-copy strong")?.textContent,
    ).toBe("Apple");
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "title" },
    });
    expect(
      document.querySelector(".qb-feedback-copy strong")?.textContent,
    ).toBe("Apple");
    expect(posts[0]?.title).toBe("Zebra");
  });

  it.each(["help", "feedback"] as const)(
    "normalizes and clears %s searches without losing keyboard focus",
    (tab) => {
      render(
        <WidgetView
          initialTab={tab}
          onClose={vi.fn()}
          articles={[
            {
              id: "a",
              category: "Basics",
              title: "First steps",
              body: "Start here.",
            },
          ]}
          feedback={[
            {
              id: "p",
              title: "First steps",
              body: "Start here.",
              author: "Ada",
              votes: 1,
            },
          ]}
        />,
      );
      const search = screen.getByRole("searchbox");
      fireEvent.change(search, { target: { value: "  FIRST  " } });
      expect(screen.getByRole("button", { name: /First steps/ })).toBeDefined();
      fireEvent.change(search, { target: { value: "nothing matches" } });
      expect(screen.getByRole("status").textContent).toContain(
        "clear your search",
      );
      screen.getByRole("button", { name: "Clear search" }).focus();
      fireEvent.click(document.activeElement!);
      expect((search as HTMLInputElement).value).toBe("");
      expect(document.activeElement).toBe(search);
      expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    },
  );

  it("waits for update actions, reports errors, and shares only through supplied actions", async () => {
    let reject!: (reason: Error) => void;
    const react = vi.fn(
      () =>
        new Promise<unknown>((_, fail) => {
          reject = fail;
        }),
    );
    const share = vi.fn(async () => ({ shared: true }));
    render(
      <WidgetView
        initialTab="updates"
        onClose={vi.fn()}
        updates={[
          {
            id: "u",
            title: "New release",
            body: "Notes",
            date: "Sep 10",
            author: "Team",
            reactions: [{ emoji: "👏", count: 2 }],
          },
        ]}
        onReactToUpdate={react}
        onShareUpdate={share}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "React 👏" }));
    expect(react).toHaveBeenCalledExactlyOnceWith("u", "👏");
    expect(
      (
        screen.getByRole("button", {
          name: "Share update",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    reject(new Error("offline"));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Share update" }));
    expect((await screen.findByRole("status")).textContent).toBe(
      "Update shared.",
    );
    expect(share).toHaveBeenCalledTimes(1);
  });
  it("navigates the five screens, searches articles, and returns from a detail", () => {
    render(
      <WidgetView
        onClose={vi.fn()}
        articles={[
          {
            id: "a",
            category: "Getting started",
            title: "First steps",
            body: "Start here.",
          },
        ]}
      />,
    );
    for (const tab of ["Messages", "Help", "Feedback", "Updates", "Home"]) {
      const button = screen.getByRole("button", { name: tab });
      fireEvent.click(button);
      expect(button.getAttribute("aria-current")).toBe("page");
    }
    fireEvent.click(screen.getByRole("button", { name: "Search for help" }));
    fireEvent.click(screen.getByRole("button", { name: /Getting started/ }));
    fireEvent.click(screen.getByRole("button", { name: "First steps" }));
    expect(screen.getByRole("heading", { name: "First steps" })).toBeDefined();
    expect(screen.getByText("Start here.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "missing" },
    });
    expect(screen.getByText("No articles match your search.")).toBeDefined();
  });

  it("searches feedback and displays a post without interpreting HTML", () => {
    render(
      <WidgetView
        initialTab="feedback"
        onClose={vi.fn()}
        feedback={[
          {
            id: "p",
            title: "An idea",
            body: "<script>bad()</script>",
            author: "Ada",
            votes: 7,
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "unmatched" },
    });
    expect(screen.getByText("No feedback matches your search.")).toBeDefined();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "IDEA" },
    });
    fireEvent.click(screen.getByRole("button", { name: /An idea/ }));
    expect(screen.getByText("<script>bad()</script>")).toBeDefined();
    expect(document.querySelector("script")).toBeNull();
  });

  it.each(["message", "feedback"] as const)(
    "submits a trimmed %s only once and keeps navigation out of the composer",
    async (kind) => {
      let finish!: () => void;
      const submit = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
      render(
        <WidgetView
          onClose={vi.fn()}
          onSendMessage={submit}
          onSubmitFeedback={submit}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: kind === "message" ? /Write a message/ : "Submit a request",
        }),
      );
      expect(screen.queryByRole("navigation")).toBeNull();
      const field = screen.getByRole("textbox");
      const send = screen.getByRole("button", {
        name: kind === "message" ? "Send" : "Post",
      });
      expect((send as HTMLButtonElement).disabled).toBe(true);
      fireEvent.change(field, { target: { value: "  A useful idea  " } });
      fireEvent.submit(field.closest("form")!);
      fireEvent.submit(field.closest("form")!);
      expect(submit).toHaveBeenCalledExactlyOnceWith("A useful idea", {
        idempotencyKey: expect.any(String),
      });
      expect((field as HTMLTextAreaElement).readOnly).toBe(true);
      expect((field as HTMLTextAreaElement).disabled).toBe(false);
      const announcement = screen.getByText(
        kind === "message" ? "Sending your message…" : "Posting your feedback…",
      );
      expect(announcement.getAttribute("aria-live")).toBe("polite");
      expect(announcement.closest('[aria-busy="true"]')).toBeNull();
      finish();
      await waitFor(() =>
        expect(screen.getByRole("status").textContent).toBe(
          kind === "message" ? "Message sent." : "Feedback submitted.",
        ),
      );
      expect(screen.getByRole("navigation")).toBeDefined();
    },
  );

  it("keeps a failed draft and allows retry", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    render(<WidgetView onClose={vi.fn()} onSendMessage={submit} />);
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "My draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const error = await screen.findByRole("alert");
    expect(error.id).not.toBe("");
    expect(
      screen
        .getByRole("textbox")
        .getAttribute("aria-describedby")
        ?.split(/\s+/),
    ).toContain(error.id);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "My draft",
    );
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByRole("status");
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it("does not navigate away from a new screen when an old submission finishes", async () => {
    let finish!: () => void;
    const submit = () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      });
    render(<WidgetView onClose={vi.fn()} onSendMessage={submit} />);
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Pending" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    finish();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Help & Support" }),
      ).toBeDefined(),
    );
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not claim a submission succeeded without a supplied callback", () => {
    render(<WidgetView onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Write a message/ }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "No backend" },
    });
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText("Sending is not available right now."),
    ).toBeDefined();
  });

  it("opens updates and conversations from supplied data", () => {
    render(
      <WidgetView
        onClose={vi.fn()}
        updates={[
          {
            id: "u",
            title: "New release",
            body: "Release notes",
            date: "Sep 10",
            author: "Team",
          },
        ]}
        conversations={[
          {
            id: "c",
            title: "A question",
            messages: [{ id: "m", author: "Ada", body: "Hello" }],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /New release/ }));
    expect(screen.getByText("Release notes")).toBeDefined();
    expect(screen.queryByRole("navigation")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Messages" }));
    fireEvent.click(screen.getByRole("button", { name: /A question/ }));
    expect(screen.getByText("Ada")).toBeDefined();
    expect(screen.getByText("Hello")).toBeDefined();
  });

  it("closes with the button or Escape", () => {
    const close = vi.fn();
    render(<WidgetView onClose={close} />);
    fireEvent.click(screen.getByRole("button", { name: "Close widget" }));
    fireEvent.keyDown(screen.getByRole("region"), { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(2);
  });
});
