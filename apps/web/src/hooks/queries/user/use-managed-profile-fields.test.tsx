import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import useManagedProfileFields from "./use-managed-profile-fields";

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  configured: [] as string[],
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({
    data: { customOAuthManagedProfileFields: m.configured },
  }),
}));
vi.mock("@/fetchers/user/get-current-user", () => ({
  default: m.getCurrentUser,
}));

function renderManagedFields() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useManagedProfileFields(), { wrapper });
}

describe("useManagedProfileFields", () => {
  afterEach(cleanup);

  beforeEach(() => {
    m.getCurrentUser.mockReset();
    m.configured = [];
  });

  it("manages nothing and asks nothing when the instance lists no fields", () => {
    const { result } = renderManagedFields();

    expect(result.current).toEqual([]);
    expect(m.getCurrentUser).not.toHaveBeenCalled();
  });

  it("locks the configured fields until the server answers", async () => {
    m.configured = ["name", "locale"];
    m.getCurrentUser.mockReturnValue(new Promise(() => {}));

    const { result } = renderManagedFields();

    expect(result.current).toEqual(["name", "locale"]);
    await waitFor(() => expect(m.getCurrentUser).toHaveBeenCalled());
  });

  it("follows the server for people with a provider account", async () => {
    m.configured = ["name", "locale"];
    m.getCurrentUser.mockResolvedValue({ managedProfileFields: ["name"] });

    const { result } = renderManagedFields();

    await waitFor(() => expect(result.current).toEqual(["name"]));
  });

  it("unlocks the fields for people without a provider account", async () => {
    m.configured = ["name", "locale"];
    m.getCurrentUser.mockResolvedValue({ managedProfileFields: [] });

    const { result } = renderManagedFields();

    await waitFor(() => expect(result.current).toEqual([]));
  });

  it("unlocks the fields when the server cannot answer", async () => {
    m.configured = ["name", "locale"];
    m.getCurrentUser.mockRejectedValue(new Error("Internal Server Error"));

    const { result } = renderManagedFields();

    expect(result.current).toEqual(["name", "locale"]);
    await waitFor(() => expect(result.current).toEqual([]));
    expect(m.getCurrentUser).toHaveBeenCalled();
  });
});
