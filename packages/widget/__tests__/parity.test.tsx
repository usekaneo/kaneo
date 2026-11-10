import { afterEach, expect, it, vi } from "vite-plus/test";
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { WidgetView, type FeedbackPost } from "../src/ui/index.js";

afterEach(cleanup);
const post: FeedbackPost = {
  id: "p",
  title: "Linear integration",
  body: "Connect our issues",
  author: "Ada",
  votes: 2,
  status: "planned",
  comments: [
    { id: "c", author: "Team", body: "Which direction?", votes: 1 },
    { id: "r", parentId: "c", author: "Ada", body: "Both ways", votes: 0 },
  ],
};
const back = () =>
  fireEvent.click(screen.getByRole("button", { name: "Back" }));

it("expands readers, restores the update scroll after a linked request, and collapses on unmount", () => {
  const expand = vi.fn();
  const view = render(
    <WidgetView
      onClose={vi.fn()}
      onExpandedChange={expand}
      initialTab="updates"
      feedback={[post]}
      updates={[
        {
          id: "u",
          title: "Our release",
          body: "Long release notes",
          date: "Nov 9",
          author: "Team",
          relatedPostIds: ["p"],
          requesterCount: 17,
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Our release/ }));
  expect(expand).toHaveBeenLastCalledWith(true);
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.queryByText(/Powered by/)).toBeNull();
  const content = document.querySelector<HTMLElement>(".qb-content")!;
  content.scrollTop = 200;
  fireEvent.click(screen.getByRole("button", { name: "Linear integration" }));
  expect(expand).toHaveBeenLastCalledWith(false);
  expect(screen.getByText("Request")).toBeDefined();
  back();
  expect(expand).toHaveBeenLastCalledWith(true);
  expect(content.scrollTop).toBe(200);
  view.unmount();
  expect(expand).toHaveBeenLastCalledWith(false);
});

it("retains roadmap expansion through request navigation", () => {
  render(
    <WidgetView
      onClose={vi.fn()}
      initialTab="feedback"
      feedback={Array.from({ length: 4 }, (_, i) => ({
        ...post,
        id: String(i),
        title: `Idea ${i}`,
      }))}
    />,
  );
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "roadmap" },
  });
  expect(screen.getByRole("heading", { name: "Roadmap" })).toBeDefined();
  expect(screen.queryByRole("button", { name: /Idea 3/ })).toBeNull();
  const content = document.querySelector<HTMLElement>(".qb-content")!;
  content.scrollTop = 240;
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  expect(content.scrollTop).toBe(240);
  fireEvent.click(screen.getByRole("button", { name: /Idea 3/ }));
  back();
  expect(
    screen
      .getByRole("button", { name: "Show less" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  expect(screen.getByRole("button", { name: /Idea 3/ })).toBeDefined();
});

it("keeps comment and reply drafts separate and retries with the same operation key", async () => {
  const comment = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost"))
    .mockResolvedValue(undefined);
  const vote = vi.fn().mockResolvedValue(undefined);
  render(
    <WidgetView
      onClose={vi.fn()}
      initialTab="feedback"
      feedback={[post]}
      onCommentFeedback={comment}
      onVoteComment={vote}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /Linear integration/ }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Root draft" },
  });
  const thread = screen.getByRole("article", { name: "Comment by Team" });
  fireEvent.click(within(thread).getByRole("button", { name: "Reply" }));
  const reply = within(thread).getByRole("textbox");
  fireEvent.change(reply, { target: { value: "Reply draft" } });
  fireEvent.click(within(thread).getByRole("button", { name: "Post comment" }));
  await screen.findByRole("alert");
  const options = comment.mock.calls[0][2];
  expect(options.parentId).toBe("c");
  fireEvent.click(within(thread).getByRole("button", { name: "Post comment" }));
  await waitFor(() => expect((reply as HTMLTextAreaElement).value).toBe(""));
  expect(comment).toHaveBeenLastCalledWith("p", "Reply draft", options);
  expect((screen.getAllByRole("textbox")[0] as HTMLTextAreaElement).value).toBe(
    "Root draft",
  );
  fireEvent.click(
    within(thread).getByRole("button", { name: "Vote for comment by Team" }),
  );
  expect(vote).toHaveBeenCalledExactlyOnceWith("p", "c", true);
  back();
  fireEvent.click(screen.getByRole("button", { name: /Linear integration/ }));
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
    "Root draft",
  );
});

it("suggests related requests without losing the feedback draft and exposes only safe article links", () => {
  render(
    <WidgetView
      onClose={vi.fn()}
      feedback={[post]}
      articles={[
        {
          id: "a",
          title: "Help",
          category: "Basics",
          body: "Article",
          url: "javascript:alert(1)",
        },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Submit a request" }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Linear integration please" },
  });
  fireEvent.click(
    within(
      screen.getByRole("complementary", { name: "Similar requests" }),
    ).getByRole("button"),
  );
  back();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
    "Linear integration please",
  );
  back();
  fireEvent.click(screen.getByRole("button", { name: "Help" }));
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Help" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Help Article" }));
  expect(screen.queryByRole("link")).toBeNull();
});

it("notifies expansion transitions without looping on an inline host callback", () => {
  const notify = vi.fn();
  function Host() {
    const [layout, setLayout] = useState({ expanded: false });
    return (
      <div data-expanded={layout.expanded}>
        <WidgetView
          onClose={() => {}}
          initialTab="updates"
          updates={[
            {
              id: "u",
              title: "Inline callback update",
              body: "Body",
              date: "Nov 9",
              author: "Team",
            },
          ]}
          onExpandedChange={(expanded) => {
            notify(expanded);
            if (notify.mock.calls.length < 12) setLayout({ expanded });
          }}
        />
      </div>
    );
  }
  render(<Host />);
  expect(notify.mock.calls).toEqual([[false]]);
  fireEvent.click(
    screen.getByRole("button", { name: /Inline callback update/ }),
  );
  expect(notify.mock.calls).toEqual([[false], [true]]);
  back();
  expect(notify.mock.calls).toEqual([[false], [true], [false]]);
});
