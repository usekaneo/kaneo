import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, render } from "@testing-library/react";
import { useLayoutEffect } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import useManagedProfileFields from "@/hooks/queries/user/use-managed-profile-fields";
import queryClient from "@/query-client";
import { Route as information } from "./information";
import { Route as preferences } from "./preferences";

const m = vi.hoisted(() => ({
  getConfig: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/fetchers/config/get-config", () => ({ getConfig: m.getConfig }));
vi.mock("@/fetchers/user/get-current-user", () => ({
  default: m.getCurrentUser,
}));
vi.mock("@/components/settings/profile/profile-page", () => ({
  ProfilePage: () => null,
}));
vi.mock("@/components/settings/preferences/preferences-page", () => ({
  PreferencesPage: () => null,
}));

type SettingsLoader = {
  handler: (match: {
    context: { queryClient: QueryClient; session: { user: { id: string } } };
  }) => Promise<void>;
};

async function renderSettingsRoute(loader: SettingsLoader) {
  const commits: unknown[] = [];
  function Page() {
    const fields = useManagedProfileFields();
    useLayoutEffect(() => {
      commits.push(fields);
    });
    return null;
  }

  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: Outlet,
  });
  const authenticated = createRoute({
    getParentRoute: () => root,
    id: "authenticated",
    beforeLoad: () => ({
      session: { user: { id: "user-1" }, session: { id: "session-1" } },
    }),
    component: Outlet,
  });
  const page = createRoute({
    getParentRoute: () => authenticated,
    path: "/page",
    loader,
    component: Page,
  });
  const elsewhere = createRoute({
    getParentRoute: () => authenticated,
    path: "/elsewhere",
  });
  const router = createRouter({
    routeTree: root.addChildren([authenticated.addChildren([page, elsewhere])]),
    history: createMemoryHistory({ initialEntries: ["/elsewhere"] }),
    context: { queryClient },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await act(() => router.load());
  return { commits, router };
}

describe.each([
  ["profile", information.options.loader],
  ["preferences", preferences.options.loader],
])("%s route", (_name, loader) => {
  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal("scrollTo", () => {});
    m.getConfig.mockReset();
    m.getCurrentUser.mockReset();
    m.getConfig.mockResolvedValue({
      customOAuthManagedProfileFields: ["name", "locale"],
    });
    m.getCurrentUser.mockResolvedValue({ managedProfileFields: ["name"] });
  });

  it("opens with the person's managed fields, also on a return visit", async () => {
    const { commits, router } = await renderSettingsRoute(
      loader as SettingsLoader,
    );

    await act(() => router.navigate({ to: "/page" }));
    expect(commits[0]).toEqual(["name"]);

    await act(() => router.navigate({ to: "/elsewhere" }));
    queryClient.removeQueries({ queryKey: ["current-user"] });
    commits.length = 0;

    let answer = () => {};
    m.getCurrentUser.mockReturnValueOnce(
      new Promise((resolve) => {
        answer = () => resolve({ managedProfileFields: ["name"] });
      }),
    );
    let returnVisit = Promise.resolve();
    // Commit whatever the router renders before the server answers.
    await act(async () => {
      returnVisit = router.navigate({ to: "/page" });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await act(async () => {
      answer();
      await returnVisit;
    });

    expect(commits[0]).toEqual(["name"]);
    expect(m.getCurrentUser).toHaveBeenCalledTimes(2);
  });
});
