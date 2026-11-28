import { beforeEach, expect, it, vi } from "vite-plus/test";
import { signOutState } from "@/lib/sign-out-state";
import { Route } from "./auth";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getSettledSession: vi.fn(),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { getSession: mocks.getSession },
}));
vi.mock("@/lib/cached-session", () => ({
  getSettledSession: mocks.getSettledSession,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  redirect: ({ to }: { to: string }) => new Error(`Redirect to ${to}`),
}));
const beforeLoad = Route.options.beforeLoad as (context: {
  location: { pathname: string };
}) => Promise<unknown>;

beforeEach(() => {
  mocks.getSession.mockReset();
  mocks.getSettledSession.mockReset().mockReturnValue(undefined);
});

it.each([
  "/auth/reset-password",
  "/auth/forgot-password",
  "/auth/reset-password/",
])("allows an existing session to open %s", async (pathname) => {
  const session = { user: { id: "existing-user" } };
  mocks.getSession.mockResolvedValue({ data: session });
  await expect(beforeLoad({ location: { pathname } })).resolves.toEqual({
    session,
  });
});

it.each(["/auth/sign-in", "/auth/sign-up", "/auth/verify-otp"])(
  "keeps the authenticated redirect on %s",
  async (pathname) => {
    mocks.getSession.mockResolvedValue({
      data: { user: { id: "existing-user" } },
    });
    await expect(beforeLoad({ location: { pathname } })).rejects.toThrow(
      "Redirect to /dashboard",
    );
  },
);

it("allows signed-out visitors to recover their password", async () => {
  mocks.getSession.mockResolvedValue({ data: null });
  await expect(
    beforeLoad({ location: { pathname: "/auth/reset-password" } }),
  ).resolves.toEqual({
    session: null,
  });
});

it("skips the session request once the session is known", async () => {
  mocks.getSettledSession.mockReturnValue(null);
  await expect(
    beforeLoad({ location: { pathname: "/auth/sign-up" } }),
  ).resolves.toEqual({ session: null });
  expect(mocks.getSession).not.toHaveBeenCalled();
});

it("lets a signing-out session reach the sign-in page", async () => {
  mocks.getSettledSession.mockReturnValue({ user: { id: "leaving" } });
  signOutState.isRedirecting = true;
  try {
    await expect(
      beforeLoad({ location: { pathname: "/auth/sign-in" } }),
    ).resolves.toEqual({ session: { user: { id: "leaving" } } });
  } finally {
    signOutState.isRedirecting = false;
  }
});
