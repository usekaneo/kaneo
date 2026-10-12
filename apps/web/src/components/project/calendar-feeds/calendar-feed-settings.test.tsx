import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  createCalendarFeed,
  getCalendarFeeds,
  revokeCalendarFeed,
} from "@/fetchers/calendar-feed";
import { toast } from "@/lib/toast";
import { CalendarFeedSettings } from "./calendar-feed-settings";

let canShare = true;
let labelsUnavailable = false;
vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    workspace: { id: "workspace-1" },
    canShareProjects: () => canShare,
    isCheckingPermissions: false,
  }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({
    data: labelsUnavailable
      ? []
      : [
          { id: "task-copy", name: "Release", color: "red", taskId: "task-1" },
          { id: "release", name: "Release", color: "red", taskId: null },
          {
            id: "maintenance",
            name: "Maintenance",
            color: "teal",
            taskId: null,
          },
        ],
    isLoading: false,
    isError: labelsUnavailable,
  }),
}));
vi.mock("@/fetchers/calendar-feed", () => ({
  getCalendarFeeds: vi.fn(),
  createCalendarFeed: vi.fn(),
  revokeCalendarFeed: vi.fn(),
  getCalendarFeedUrl: (token: string) =>
    `https://kaneo.example/api/calendar-feed/${token}/calendar.ics`,
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const feed = {
  id: "feed-1",
  projectId: "project-1",
  token: "secret",
  labelIds: ["release"],
  timeZone: "Europe/Berlin",
  createdAt: "2026-09-23T12:00:00Z",
};
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CalendarFeedSettings projectId="project-1" />
    </QueryClientProvider>,
  );
}

async function openNewFeedDialog() {
  const [newFeed] = await screen.findAllByRole("button", {
    name: "settings:calendarFeeds.newFeed",
  });
  fireEvent.click(newFeed);
  return screen.findByRole("dialog");
}

describe("CalendarFeedSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
    canShare = true;
    labelsUnavailable = false;
    vi.mocked(getCalendarFeeds).mockResolvedValue([]);
    vi.mocked(createCalendarFeed).mockResolvedValue(feed);
    vi.mocked(revokeCalendarFeed).mockResolvedValue({ success: true });
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

  it("creates a feed from multiple labels using definition IDs instead of task copies", async () => {
    renderSettings();
    const dialog = await openNewFeedDialog();
    const create = within(dialog).getByRole("button", {
      name: "settings:calendarFeeds.create",
    });
    expect(create).toBeEnabled();
    const input = within(dialog).getByRole("combobox");
    fireEvent.change(input, { target: { value: "Release" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Release" }), {
      detail: 1,
    });
    await waitFor(() => expect(create).not.toBeDisabled());
    fireEvent.change(input, { target: { value: "Maintenance" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.click(
      await screen.findByRole("option", { name: "Maintenance" }),
      { detail: 1 },
    );
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.click(create);
    await waitFor(() =>
      expect(createCalendarFeed).toHaveBeenCalledWith(
        "project-1",
        ["release", "maintenance"],
        browserTimeZone,
      ),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "settings:calendarFeeds.created",
        { icon: expect.anything() },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("Release")).not.toBeInTheDocument();
  });

  it.each([false, true])(
    "creates an unfiltered feed without selecting labels (labels unavailable: %s)",
    async (unavailable) => {
      labelsUnavailable = unavailable;
      const unfilteredFeed = { ...feed, labelIds: [] };
      vi.mocked(createCalendarFeed).mockResolvedValue(unfilteredFeed);
      vi.mocked(getCalendarFeeds)
        .mockResolvedValueOnce([])
        .mockResolvedValue([unfilteredFeed]);
      renderSettings();
      const dialog = await openNewFeedDialog();
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: "settings:calendarFeeds.create",
        }),
      );
      await waitFor(() =>
        expect(createCalendarFeed).toHaveBeenCalledWith(
          "project-1",
          [],
          browserTimeZone,
        ),
      );
      expect(
        await screen.findByText("settings:calendarFeeds.allScheduledTasks"),
      ).toBeInTheDocument();
    },
  );

  it("shows the feed labels, copies the link and revokes only after confirmation", async () => {
    vi.mocked(getCalendarFeeds).mockResolvedValue([
      { ...feed, labelIds: ["release", "gone"] },
    ]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderSettings();
    expect(await screen.findByText("Release")).toBeInTheDocument();
    expect(
      screen.getByText("settings:calendarFeeds.deletedLabel"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "https://kaneo.example/api/calendar-feed/secret/calendar.ics",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "settings:calendarFeeds.copy" }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "https://kaneo.example/api/calendar-feed/secret/calendar.ics",
      ),
    );
    expect(
      await screen.findByRole("button", {
        name: "settings:calendarFeeds.copiedLabel",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:calendarFeeds.feedActions",
      }),
    );
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "settings:calendarFeeds.revoke",
      }),
    );
    const confirm = await screen.findByRole("alertdialog");
    expect(revokeCalendarFeed).not.toHaveBeenCalled();
    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:calendarFeeds.revokeConfirm",
      }),
    );
    await waitFor(() =>
      expect(revokeCalendarFeed).toHaveBeenCalledWith("project-1", "feed-1"),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "settings:calendarFeeds.revoked",
        { icon: expect.anything() },
      ),
    );
  });

  it("shows the empty state with a create action and the browser time zone", async () => {
    renderSettings();
    expect(
      await screen.findByText("settings:calendarFeeds.emptyTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "settings:calendarFeeds.newFeed" }),
    ).toHaveLength(2);
    expect(
      screen.getByText(/settings:calendarFeeds\.timeZoneHint/),
    ).toBeInTheDocument();
  });

  it("does not fetch secret links or show controls without sharing permission", () => {
    canShare = false;
    renderSettings();
    expect(
      screen.getByText("settings:calendarFeeds.permissionRequired"),
    ).toBeInTheDocument();
    expect(getCalendarFeeds).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "settings:calendarFeeds.newFeed" }),
    ).not.toBeInTheDocument();
  });

  it("reports loading failures without presenting a misleading empty state", async () => {
    vi.mocked(getCalendarFeeds).mockRejectedValue(new Error("Offline"));
    renderSettings();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "settings:calendarFeeds.loadError",
    );
    expect(
      screen.queryByText("settings:calendarFeeds.emptyTitle"),
    ).not.toBeInTheDocument();
  });
});
