import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCalendarFeed,
  getCalendarFeeds,
  revokeCalendarFeed,
} from "@/fetchers/calendar-feed";
import { toast } from "@/lib/toast";
import { CalendarFeedSettings } from "./calendar-feed-settings";

let canShare = true;
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
    data: [
      { id: "task-copy", name: "Release", taskId: "task-1" },
      { id: "release", name: "Release", taskId: null },
      { id: "maintenance", name: "Maintenance", taskId: null },
    ],
    isLoading: false,
    isError: false,
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

describe("CalendarFeedSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
    canShare = true;
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
    const create = screen.getByRole("button", {
      name: "settings:calendarFeeds.create",
    });
    expect(create).toBeDisabled();
    const input = screen.getByRole("combobox");
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
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    );
    await waitFor(() => expect(create).toBeDisabled());
    expect(toast.success).toHaveBeenCalledWith(
      "settings:calendarFeeds.created",
    );
  });

  it("copies a subscription URL and revokes the selected feed", async () => {
    vi.mocked(getCalendarFeeds).mockResolvedValue([feed]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderSettings();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "settings:calendarFeeds.copy",
      }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "https://kaneo.example/api/calendar-feed/secret/calendar.ics",
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "settings:calendarFeeds.revoke" }),
    );
    await waitFor(() =>
      expect(revokeCalendarFeed).toHaveBeenCalledWith("project-1", "feed-1"),
    );
  });

  it("does not fetch secret links or show controls without sharing permission", () => {
    canShare = false;
    renderSettings();
    expect(
      screen.getByText("settings:calendarFeeds.permissionRequired"),
    ).toBeInTheDocument();
    expect(getCalendarFeeds).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("reports loading failures without presenting a misleading empty state", async () => {
    vi.mocked(getCalendarFeeds).mockRejectedValue(new Error("Offline"));
    renderSettings();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "settings:calendarFeeds.loadError",
    );
    expect(
      screen.queryByText("settings:calendarFeeds.empty"),
    ).not.toBeInTheDocument();
  });
});
