import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { getAdminOverview } from "@/fetchers/admin/get-admin-overview";
import useAdminOverview from "./use-admin-overview";

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "admin" } }),
}));
vi.mock("@/fetchers/admin/get-admin-overview", () => ({
  getAdminOverview: vi.fn(),
}));
afterEach(cleanup);

it("refreshes cached overview data on reopening despite the app's refetchOnMount default", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { refetchOnMount: false, retry: false } },
  });
  client.setQueryData(["admin", "overview", "admin"], { users: { total: 1 } });
  vi.mocked(getAdminOverview).mockResolvedValue({
    users: { total: 2 },
  } as Awaited<ReturnType<typeof getAdminOverview>>);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result, unmount } = renderHook(useAdminOverview, { wrapper });
  await waitFor(() => expect(result.current.data?.users.total).toBe(2));
  expect(getAdminOverview).toHaveBeenCalledTimes(1);
  unmount();
  client.clear();
});
