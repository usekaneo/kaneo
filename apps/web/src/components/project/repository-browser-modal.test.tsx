import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RepositoryBrowserModal } from "./repository-browser-modal";

const m = vi.hoisted(() => ({ list: vi.fn(), userId: "user-1" }));
vi.mock("@/fetchers/github-integration/list-repositories", () => ({
  default: m.list,
}));
vi.mock("@/fetchers/github-integration/get-app-info", () => ({
  default: async () => ({ appName: null }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: m.userId } } }) },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  for (const client of clients) client.clear();
  clients.length = 0;
});
beforeEach(() => {
  vi.clearAllMocks();
  m.userId = "user-1";
});
function result(
  name: string,
  nextPage: { installationPage: number; repositoryPage: number } | null,
) {
  return {
    repositories: name
      ? [
          {
            id: 1,
            name,
            full_name: `owner/${name}`,
            owner: { login: "owner", avatar_url: "", type: "User" },
            private: true,
            html_url: "https://github.com/owner/repo",
            description: "",
            updated_at: "2026-09-01",
          },
        ]
      : [],
    installations: [],
    total: name ? 1 : 0,
    nextPage,
  };
}
function show() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  clients.push(client);
  const selected = vi.fn();
  const node = () => (
    <QueryClientProvider client={client}>
      <RepositoryBrowserModal
        open
        projectId="project"
        onOpenChange={vi.fn()}
        onSelectRepository={selected}
      />
    </QueryClientProvider>
  );
  const view = render(node());
  return { selected, refresh: () => view.rerender(node()) };
}
describe("bounded GitHub repository browser", () => {
  it("requests later pages only on Next, including an empty installation page, and supports Previous", async () => {
    m.list
      .mockResolvedValueOnce(
        result("first", { installationPage: 2, repositoryPage: 1 }),
      )
      .mockResolvedValueOnce(
        result("", { installationPage: 3, repositoryPage: 1 }),
      )
      .mockResolvedValueOnce(result("last", null));
    const { selected } = show();
    await screen.findByText("owner/first");
    expect(m.list).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("common:pagination.next"));
    await screen.findByText("settings:repositoryBrowser.emptyTitle");
    expect(m.list).toHaveBeenLastCalledWith("project", {
      installationPage: 2,
      repositoryPage: 1,
    });
    fireEvent.click(screen.getByText("common:pagination.next"));
    await screen.findByText("owner/last");
    expect(
      screen.getByText("common:pagination.next").closest("button"),
    ).toBeDisabled();
    fireEvent.click(screen.getByText("common:pagination.previous"));
    await screen.findByText("settings:repositoryBrowser.emptyTitle");
    fireEvent.click(screen.getByText("common:pagination.previous"));
    await screen.findByText("owner/first");
    expect(m.list).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByText("owner/first"));
    expect(selected).toHaveBeenCalledWith({ owner: "owner", name: "first" });
  });
  it("isolates cached results after an account switch", async () => {
    m.list
      .mockResolvedValueOnce(result("private-old-user", null))
      .mockRejectedValueOnce(new Error("Forbidden"));
    const { refresh } = show();
    await screen.findByText("owner/private-old-user");
    m.userId = "user-2";
    refresh();
    expect(screen.queryByText("owner/private-old-user")).toBeNull();
    await screen.findByText("settings:repositoryBrowser.loadError");
    expect(screen.queryByText("owner/private-old-user")).toBeNull();
  });
  it("retries a failed continuation without silently showing the previous page", async () => {
    m.list
      .mockResolvedValueOnce(
        result("first", { installationPage: 1, repositoryPage: 2 }),
      )
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(result("second", null));
    show();
    await screen.findByText("owner/first");
    fireEvent.click(screen.getByText("common:pagination.next"));
    await screen.findByText("settings:repositoryBrowser.loadError");
    expect(screen.queryByText("owner/first")).toBeNull();
    fireEvent.click(screen.getByText("settings:repositoryBrowser.tryAgain"));
    await screen.findByText("owner/second");
    await waitFor(() =>
      expect(m.list).toHaveBeenLastCalledWith("project", {
        installationPage: 1,
        repositoryPage: 2,
      }),
    );
  });
});
