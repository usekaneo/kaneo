import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./onboarding";

const getWorkspaces = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: (options: unknown) => ({ redirect: options }),
}));

vi.mock("@/fetchers/workspace/get-workspaces", () => ({
  default: () => getWorkspaces(),
}));

vi.mock("@/lib/http-error", () => ({
  isUnauthorizedError: () => false,
  handleUnauthorized: vi.fn(),
}));

vi.mock("@/components/onboarding/onboarding-flow", () => ({
  OnboardingFlow: () => null,
}));

const beforeLoad = (Route as unknown as { beforeLoad: () => Promise<void> })
  .beforeLoad;

afterEach(() => {
  vi.clearAllMocks();
});

describe("onboarding route", () => {
  it("sends someone who already has a workspace to the dashboard", async () => {
    getWorkspaces.mockResolvedValue([{ id: "workspace-1" }]);
    await expect(beforeLoad()).rejects.toEqual({
      redirect: { to: "/dashboard" },
    });
  });

  it("shows the flow when there is no workspace yet", async () => {
    getWorkspaces.mockResolvedValue([]);
    await expect(beforeLoad()).resolves.toBeUndefined();
  });

  it("surfaces a failed lookup instead of offering another workspace", async () => {
    const error = new Error("offline");
    getWorkspaces.mockRejectedValue(error);
    await expect(beforeLoad()).rejects.toBe(error);
  });
});
