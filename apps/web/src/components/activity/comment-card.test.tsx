import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCommentReplyStore } from "@/store/comment-reply";
import CommentCard from "./comment-card";

const react = vi.fn();
vi.mock("@/hooks/mutations/comment/use-react-to-comment", () => ({
  default: () => ({ mutate: react }),
}));

// Previews fetch from the API; the card only needs to decide to show one.
vi.mock("@/components/chat/link-preview-card", () => ({
  LinkPreviewCard: ({ url }: { url: string }) => <div>preview {url}</div>,
}));

vi.mock("@/components/activity/comment-editor", () => ({
  default: ({ value }: { value: string }) => <div>{value}</div>,
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/mutations/comment/use-update-comment", () => ({
  default: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/lib/format", () => ({
  formatRelativeTime: () => "2 hours ago",
  formatDateTime: () => "Apr 5, 2026, 11:38 AM",
}));

vi.mock("@/components/ui/tooltip", async () => {
  const React = await import("react");

  function Tooltip({ children }: { children: ReactNode }) {
    const [open, setOpen] = React.useState(false);
    return (
      <div data-testid="tooltip-root">
        {React.Children.map(children, (child) =>
          isValidElement(child)
            ? cloneElement(
                child as ReactElement<{
                  open?: boolean;
                  setOpen?: (open: boolean) => void;
                }>,
                {
                  open,
                  setOpen,
                },
              )
            : child,
        )}
      </div>
    );
  }

  function TooltipTrigger({
    children,
    setOpen,
  }: {
    children: ReactElement;
    setOpen?: (open: boolean) => void;
  }) {
    return cloneElement(children as ReactElement<Record<string, unknown>>, {
      onMouseEnter: () => setOpen?.(true),
      onMouseLeave: () => setOpen?.(false),
      onFocus: () => setOpen?.(true),
      onBlur: () => setOpen?.(false),
    });
  }

  function TooltipContent({
    children,
    open,
  }: {
    children: ReactNode;
    open?: boolean;
  }) {
    return open ? <div role="tooltip">{children}</div> : null;
  }

  function TooltipProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }

  return {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  };
});

function renderCommentCard(
  props: Partial<Parameters<typeof CommentCard>[0]> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CommentCard
        commentId="comment-1"
        taskId="task-1"
        content="Test comment"
        createdAt="2026-04-05T09:38:50.000Z"
        user={{
          id: "user-1",
          name: "Tin",
          email: "tin@example.com",
          image: null,
        }}
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("CommentCard", () => {
  afterEach(() => {
    cleanup();
    useCommentReplyStore.getState().clear();
  });

  it("shows full date+short time in tooltip on hover/focus", async () => {
    renderCommentCard();

    const trigger = screen.getByRole("button", {
      name: "Apr 5, 2026, 11:38 AM",
    });

    fireEvent.mouseEnter(trigger);
    expect(await screen.findByText("Apr 5, 2026, 11:38 AM")).toBeVisible();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByText("Apr 5, 2026, 11:38 AM")).not.toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(await screen.findByText("Apr 5, 2026, 11:38 AM")).toBeVisible();
  });

  it("shows the quoted comment, edits, reactions and link previews", () => {
    renderCommentCard({
      content: "See https://example.com/spec for details",
      editedAt: "2026-04-05T10:00:00.000Z",
      replyTo: { id: "comment-0", userName: "Ana", excerpt: "Is it ready?" },
      reactions: [{ emoji: "🎉", userIds: ["user-2", "user-3"] }],
      canInteract: true,
    });

    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Is it ready?")).toBeInTheDocument();
    expect(screen.getByText("activity:comment.edited")).toBeInTheDocument();
    expect(screen.getByText("preview https://example.com/spec")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /🎉\s*2/ }));
    expect(react).toHaveBeenCalledWith(
      { activityId: "comment-1", emoji: "🎉" },
      expect.anything(),
    );
  });

  it("starts a reply that quotes this comment", () => {
    renderCommentCard({ canInteract: true });
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "activity:comment.reply",
      })[0] as HTMLElement,
    );
    expect(useCommentReplyStore.getState().replyTo).toEqual({
      taskId: "task-1",
      id: "comment-1",
      userName: "Tin",
      excerpt: "Test comment",
    });
  });

  it("hides reacting and replying from people who can't comment", () => {
    renderCommentCard({ canInteract: false });
    expect(
      screen.queryByRole("button", { name: "activity:comment.reply" }),
    ).not.toBeInTheDocument();
  });
});
