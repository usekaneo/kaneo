import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPendingInvitations } from "@/fetchers/invitation/get-pending-invitations";
import { HttpError, handleUnauthorized } from "@/lib/http-error";
import queryClient from "@/query-client";
import { usePendingInvitations } from "./use-pending-invitations";

const auth = vi.hoisted(() => ({
  email: "member@example.test" as string | undefined,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { email: auth.email } } }) },
}));
vi.mock("@/fetchers/invitation/get-pending-invitations", () => ({
  getPendingInvitations: vi.fn(),
}));
vi.mock("@/lib/http-error", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/http-error")>()),
  // Leave the page mounted to exercise a delayed sign-in redirect.
  handleUnauthorized: vi.fn(),
}));
vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));

function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(getPendingInvitations).mockReset();
  auth.email = "member@example.test";
});

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.useRealTimers();
});

describe("pending invitation polling", () => {
  it.each([
    ["HttpError", new HttpError(401, "Session expired")],
    ["an error with a different prototype", { name: "HttpError", status: 401 }],
  ])(
    "stops after a 401 from %s even with a stale session",
    async (_, error) => {
      vi.mocked(getPendingInvitations).mockRejectedValue(error);
      const { result, rerender } = renderHook(usePendingInvitations, {
        wrapper,
      });
      await advance(1);
      expect(handleUnauthorized).toHaveBeenCalledTimes(1);

      rerender();
      await advance(180_000);

      expect(getPendingInvitations).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBe(error);
      expect(handleUnauthorized).toHaveBeenCalledTimes(1);
    },
  );

  it("continues polling every minute while signed in", async () => {
    vi.mocked(getPendingInvitations).mockResolvedValue([]);
    renderHook(usePendingInvitations, { wrapper });
    await advance(1);
    expect(getPendingInvitations).toHaveBeenCalledTimes(1);
    await advance(60_000);
    expect(getPendingInvitations).toHaveBeenCalledTimes(2);
    expect(handleUnauthorized).not.toHaveBeenCalled();
  });

  it("does not poll without a session email", async () => {
    auth.email = undefined;
    renderHook(usePendingInvitations, { wrapper });
    await advance(180_000);
    expect(getPendingInvitations).not.toHaveBeenCalled();
  });
});
