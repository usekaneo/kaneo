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
import { GithubRepositoryPicker } from "./github-repository-picker";

const m = vi.hoisted(() => ({ list: vi.fn(), userId: "user-1" }));
vi.mock("@/fetchers/github-integration/list-repositories", () => ({
  default: m.list,
  FIRST_REPOSITORY_PAGE: { installationPage: 1, repositoryPage: 1 },
}));
vi.mock("@/fetchers/github-integration/get-app-info", () => ({
  default: async () => ({ appName: null }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: m.userId } } }) },
}));
vi.mock("@/hooks/use-locale", () => ({
  useLocale: () => ({ locale: "en-US" }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

type Page = { installationPage: number; repositoryPage: number };

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

function repository(id: number, name: string) {
  return {
    id,
    name,
    full_name: `owner/${name}`,
    owner: { login: "owner", avatar_url: "", type: "User" },
    private: true,
    html_url: `https://github.com/owner/${name}`,
    description: "",
    updated_at: "2026-09-01",
    installation_id: 1,
  };
}

function result(names: string[], nextPage: Page | null, offset = 0) {
  return {
    repositories: names.map((name, index) =>
      repository(offset + index + 1, name),
    ),
    installations: [],
    total: names.length,
    nextPage,
  };
}

function show(selectedRepository?: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  clients.push(client);
  const selected = vi.fn();
  const onOpenChange = vi.fn();
  const node = () => (
    <QueryClientProvider client={client}>
      <GithubRepositoryPicker
        open
        projectId="project"
        onOpenChange={onOpenChange}
        onSelectRepository={selected}
        selectedRepository={selectedRepository}
      />
    </QueryClientProvider>
  );
  const view = render(node());
  return { selected, onOpenChange, refresh: () => view.rerender(node()) };
}

describe("GitHub repository picker", () => {
  it("loads more pages on demand and keeps earlier results", async () => {
    m.list
      .mockResolvedValueOnce(
        result(["first"], { installationPage: 2, repositoryPage: 1 }),
      )
      .mockResolvedValueOnce(result(["second"], null, 10));
    show();
    await screen.findByText("owner/first");
    expect(m.list).toHaveBeenCalledTimes(1);
    expect(m.list).toHaveBeenLastCalledWith(
      "project",
      { installationPage: 1, repositoryPage: 1 },
      undefined,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:repositoryBrowser.loadMore",
      }),
    );
    await screen.findByText("owner/second");
    expect(screen.getByText("owner/first")).toBeInTheDocument();
    expect(m.list).toHaveBeenLastCalledWith(
      "project",
      { installationPage: 2, repositoryPage: 1 },
      undefined,
    );
    expect(
      screen.queryByRole("button", {
        name: "settings:repositoryBrowser.loadMore",
      }),
    ).toBeNull();
  });

  it("selects a row and uses it only after confirming", async () => {
    m.list.mockResolvedValueOnce(result(["first", "second"], null));
    const { selected, onOpenChange } = show("owner/first");
    const first = await screen.findByRole("button", { name: /owner\/first/ });
    expect(first).toHaveAttribute("aria-pressed", "true");
    const second = screen.getByRole("button", { name: /owner\/second/ });
    fireEvent.click(second);
    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(selected).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:repositoryBrowser.useRepository",
      }),
    );
    expect(selected).toHaveBeenCalledWith({ owner: "owner", name: "second" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("searches on the server and keeps scanning until enough matches load", async () => {
    m.list.mockImplementation(
      async (_projectId: string, page: Page, search?: string) => {
        if (!search) return result(["unrelated"], null, 500);
        if (page.installationPage === 2) return result(["web-three"], null, 20);
        if (page.repositoryPage === 1)
          return result(["web-one"], {
            installationPage: 1,
            repositoryPage: 2,
          });
        return result(
          ["web-two"],
          { installationPage: 2, repositoryPage: 1 },
          10,
        );
      },
    );
    show();
    await screen.findByText("owner/unrelated");
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "settings:repositoryBrowser.searchPlaceholder",
      }),
      { target: { value: " web " } },
    );
    await screen.findByText("owner/web-three", {}, { timeout: 2000 });
    expect(screen.getByText("owner/web-one")).toBeInTheDocument();
    expect(screen.getByText("owner/web-two")).toBeInTheDocument();
    expect(screen.queryByText("owner/unrelated")).toBeNull();
    expect(m.list).toHaveBeenCalledWith(
      "project",
      { installationPage: 1, repositoryPage: 1 },
      "web",
    );
    expect(m.list).toHaveBeenCalledWith(
      "project",
      { installationPage: 2, repositoryPage: 1 },
      "web",
    );
  });

  it("caps automatic search requests and offers to load more", async () => {
    let page = 0;
    m.list.mockImplementation(
      async (_projectId: string, _page: Page, search?: string) => {
        if (!search) return result([], null);
        page += 1;
        return result([], { installationPage: page + 1, repositoryPage: 1 });
      },
    );
    show();
    await screen.findByText("settings:repositoryBrowser.emptyTitle");
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "settings:repositoryBrowser.searchPlaceholder",
      }),
      { target: { value: "missing" } },
    );
    await screen.findByRole(
      "button",
      { name: "settings:repositoryBrowser.loadMore" },
      { timeout: 3000 },
    );
    expect(page).toBe(6);
  });

  it("isolates cached results after an account switch", async () => {
    m.list
      .mockResolvedValueOnce(result(["private-old-user"], null))
      .mockRejectedValueOnce(new Error("Forbidden"));
    const { refresh } = show();
    await screen.findByText("owner/private-old-user");
    m.userId = "user-2";
    refresh();
    expect(screen.queryByText("owner/private-old-user")).toBeNull();
    await screen.findByText("settings:repositoryBrowser.loadError");
    expect(screen.queryByText("owner/private-old-user")).toBeNull();
  });

  it("retries a failed continuation from the same cursor", async () => {
    m.list
      .mockResolvedValueOnce(
        result(["first"], { installationPage: 1, repositoryPage: 2 }),
      )
      .mockRejectedValueOnce(new Error("Unavailable"))
      .mockResolvedValueOnce(result(["second"], null, 10));
    show();
    await screen.findByText("owner/first");
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:repositoryBrowser.loadMore",
      }),
    );
    await screen.findByText("settings:repositoryBrowser.loadError");
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:repositoryBrowser.tryAgain",
      }),
    );
    await screen.findByText("owner/second");
    await waitFor(() =>
      expect(m.list).toHaveBeenLastCalledWith(
        "project",
        { installationPage: 1, repositoryPage: 2 },
        undefined,
      ),
    );
  });
});
