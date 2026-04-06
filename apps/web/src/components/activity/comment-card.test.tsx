import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";
import CommentCard from "./comment-card";

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

function renderCommentCard() {
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
      />
    </QueryClientProvider>,
  );
}

describe("CommentCard", () => {
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
});
