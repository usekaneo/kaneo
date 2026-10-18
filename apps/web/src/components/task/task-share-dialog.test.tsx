import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ensureTaskShare, revokeTaskShare } from "@/fetchers/task-share";
import { toast } from "@/lib/toast";
import TaskShareDialog from "./task-share-dialog";

const state = vi.hoisted(() => ({
  share: null as null | {
    taskId: string;
    token: string;
    createdAt: string;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("@/hooks/queries/task/use-get-task-share", () => ({
  useGetTaskShare: () => ({
    data: { share: state.share },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/fetchers/task-share", () => ({
  ensureTaskShare: vi.fn(),
  revokeTaskShare: vi.fn(),
  getSharedTaskUrl: (token: string) =>
    `https://kaneo.example/shared-task/${token}`,
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TaskShareDialog taskId="task-1" open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("TaskShareDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.share = null;
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("warns before creating an anonymous link", async () => {
    vi.mocked(ensureTaskShare).mockResolvedValue({
      taskId: "task-1",
      token: "token-1",
      createdAt: "2026-10-18T12:00:00.000Z",
    });
    renderDialog();
    expect(screen.getByText("tasks:share.accessWarning")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "tasks:share.create" }));
    await waitFor(() => expect(ensureTaskShare).toHaveBeenCalledWith("task-1"));
    expect(toast.success).toHaveBeenCalledWith("tasks:share.created");
  });

  it("copies and explicitly confirms revocation", async () => {
    state.share = {
      taskId: "task-1",
      token: "token-1",
      createdAt: "2026-10-18T12:00:00.000Z",
    };
    vi.mocked(revokeTaskShare).mockResolvedValue({ success: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "tasks:share.copy" }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "https://kaneo.example/shared-task/token-1",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "tasks:share.revoke" }));
    expect(revokeTaskShare).not.toHaveBeenCalled();
    expect(
      screen.getByText("tasks:share.revokeConfirmation"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "tasks:share.revoke" }));
    await waitFor(() => expect(revokeTaskShare).toHaveBeenCalledWith("task-1"));
    expect(toast.success).toHaveBeenCalledWith("tasks:share.revoked");
  });
});
