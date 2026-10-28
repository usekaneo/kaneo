import { onlineManager, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import queryClient from "@/query-client";
import { prefetchManagedProfileFields } from "./prefetch-managed-profile-fields";
import useManagedProfileFields from "./use-managed-profile-fields";

const m = vi.hoisted(() => ({
  getConfig: vi.fn(),
  getCurrentUser: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("@sentry/react", () => ({ captureException: m.captureException }));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/fetchers/config/get-config", () => ({ getConfig: m.getConfig }));
vi.mock("@/fetchers/user/get-current-user", () => ({
  default: m.getCurrentUser,
}));

const wrapper = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

function managedFieldsOnFirstRender() {
  const renders: ReturnType<typeof useManagedProfileFields>[] = [];
  renderHook(
    () => {
      const fields = useManagedProfileFields();
      renders.push(fields);
      return fields;
    },
    { wrapper },
  );
  return renders[0];
}

function instanceManages(fields: string[]) {
  m.getConfig.mockResolvedValue({ customOAuthManagedProfileFields: fields });
}

describe("prefetchManagedProfileFields", () => {
  afterEach(() => {
    cleanup();
    queryClient.clear();
    onlineManager.setOnline(true);
  });

  beforeEach(() => {
    m.getConfig.mockReset();
    m.getCurrentUser.mockReset();
    m.captureException.mockClear();
  });

  it("opens with the server's fields for people with a provider account", async () => {
    instanceManages(["name", "locale"]);
    m.getCurrentUser.mockResolvedValue({ managedProfileFields: ["name"] });

    await prefetchManagedProfileFields(queryClient, "user-1");

    expect(managedFieldsOnFirstRender()).toEqual(["name"]);
    expect(m.getConfig).toHaveBeenCalledTimes(1);
    expect(m.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("opens unlocked for people without a provider account", async () => {
    instanceManages(["name", "locale"]);
    m.getCurrentUser.mockResolvedValue({ managedProfileFields: [] });

    await prefetchManagedProfileFields(queryClient, "user-1");

    expect(managedFieldsOnFirstRender()).toEqual([]);
    expect(m.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("asks nothing about the user when the instance manages no fields", async () => {
    instanceManages([]);

    await prefetchManagedProfileFields(queryClient, "user-1");

    expect(managedFieldsOnFirstRender()).toEqual([]);
    expect(m.getCurrentUser).not.toHaveBeenCalled();
  });

  it("rides out a single failed config request", async () => {
    instanceManages(["name", "locale"]);
    m.getConfig.mockRejectedValueOnce(new Error("Service Unavailable"));
    m.getCurrentUser.mockResolvedValue({ managedProfileFields: ["name"] });

    await prefetchManagedProfileFields(queryClient, "user-1");

    expect(managedFieldsOnFirstRender()).toEqual(["name"]);
    expect(m.getConfig).toHaveBeenCalledTimes(2);
    expect(m.captureException).not.toHaveBeenCalled();
  });

  it("rides out a single failed user lookup", async () => {
    instanceManages(["name", "locale"]);
    m.getCurrentUser
      .mockRejectedValueOnce(new Error("Service Unavailable"))
      .mockResolvedValue({ managedProfileFields: ["name"] });

    await prefetchManagedProfileFields(queryClient, "user-1");

    expect(managedFieldsOnFirstRender()).toEqual(["name"]);
    expect(m.getCurrentUser).toHaveBeenCalledTimes(2);
    expect(m.captureException).not.toHaveBeenCalled();
  });

  it("lets the page open when the server keeps failing", async () => {
    instanceManages(["name", "locale"]);
    m.getCurrentUser.mockRejectedValue(new Error("Service Unavailable"));

    await expect(
      prefetchManagedProfileFields(queryClient, "user-1"),
    ).resolves.toBeUndefined();
    expect(m.getCurrentUser).toHaveBeenCalledTimes(3);
  });

  it("lets the page open while offline", async () => {
    onlineManager.setOnline(false);
    instanceManages(["name"]);
    m.getCurrentUser.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      prefetchManagedProfileFields(queryClient, "user-1"),
    ).resolves.toBeUndefined();
    expect(m.getCurrentUser).toHaveBeenCalledTimes(1);
  });
});
