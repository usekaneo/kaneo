import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { cloneElement, isValidElement } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import CommentCard from "./comment-card";
import { toast } from "@/lib/toast";

const mocks = vi.hoisted(() => ({
  currentUserId: null as string | null,
  deleteComment: vi.fn(async () => ({})),
  pending: false,
}));
beforeEach(() => {
  mocks.currentUserId = null;
  mocks.pending = false;
  vi.clearAllMocks();
});
vi.mock("@/hooks/mutations/comment/use-delete-comment", () => ({
  default: () => ({
    mutateAsync: mocks.deleteComment,
    isPending: mocks.pending,
  }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(cleanup);

vi.mock("@/components/activity/comment-editor", () => ({
  default: ({ value }: { value: string }) => <div>{value}</div>,
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({
    user: mocks.currentUserId ? { id: mocks.currentUserId } : null,
  }),
}));

vi.mock("@/hooks/mutations/comment/use-update-comment", () => ({
  default: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      `${key}${values ? ` ${Object.values(values).join(" ")}` : ""}`,
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

function renderCommentCard(externalSource?: string, importedBy?: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CommentCard
        externalSource={externalSource}
        importedBy={importedBy}
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
  it("disables the confirmation actions while deletion is pending", async () => {
    mocks.currentUserId = "user-1";
    mocks.pending = true;
    renderCommentCard();
    fireEvent.click(
      screen.getByRole("button", { name: "common:actions.delete" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", {
      name: "common:actions.deleting",
    });
    expect(confirm).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "common:actions.cancel" }),
    ).toBeDisabled();
    fireEvent.click(confirm);
    expect(mocks.deleteComment).not.toHaveBeenCalled();
  });
  it("requires confirmation and lets the author cancel without deleting", async () => {
    mocks.currentUserId = "user-1";
    renderCommentCard();
    fireEvent.click(
      screen.getByRole("button", { name: "common:actions.delete" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("activity:comment.deleteDescription"),
    ).toBeVisible();
    expect(mocks.deleteComment).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common:actions.cancel" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(mocks.deleteComment).not.toHaveBeenCalled();
  });

  it("deletes the comment only after confirmation", async () => {
    mocks.currentUserId = "user-1";
    renderCommentCard();
    fireEvent.click(
      screen.getByRole("button", { name: "common:actions.delete" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common:actions.delete" }),
    );
    await waitFor(() =>
      expect(mocks.deleteComment).toHaveBeenCalledExactlyOnceWith({
        activityId: "comment-1",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(toast.success).toHaveBeenCalledWith("activity:comment.deleted");
  });

  it("keeps the confirmation and comment available after a failed deletion", async () => {
    mocks.currentUserId = "user-1";
    mocks.deleteComment.mockRejectedValueOnce(new Error("Deletion rejected"));
    renderCommentCard();
    fireEvent.click(
      screen.getByRole("button", { name: "common:actions.delete" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common:actions.delete" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Deletion rejected"),
    );
    expect(dialog).toBeVisible();
    expect(screen.getByText("Test comment")).toBeVisible();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not offer deletion for another user's comment", () => {
    mocks.currentUserId = "user-2";
    renderCommentCard();
    expect(
      screen.queryByRole("button", { name: "common:actions.delete" }),
    ).not.toBeInTheDocument();
  });
  it.each(["planka", "trello", "jira", "github"])(
    "visibly identifies %s authors as imported without hovering",
    (source) => {
      renderCommentCard(source, "Actual Importer");
      expect(screen.getByText(/activity:comment.importedFrom/)).toBeVisible();
      expect(
        screen.getByText(/activity:comment.importedBy Actual Importer/),
      ).toBeVisible();
    },
  );

  it("does not label ordinary comments as imports", () => {
    renderCommentCard();
    expect(
      screen.queryByText(/activity:comment.importedFrom/),
    ).not.toBeInTheDocument();
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
});
