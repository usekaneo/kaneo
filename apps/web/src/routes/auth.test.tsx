import { beforeEach, expect, it, vi } from "vitest";
import { Route } from "./auth";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: mocks }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  redirect: ({ to }: { to: string }) => new Error(`Redirect to ${to}`),
}));
const beforeLoad = Route.options.beforeLoad as (context: {
  location: { pathname: string };
}) => Promise<unknown>;

beforeEach(() => mocks.getSession.mockReset());

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
  ).resolves.toEqual({ session: null });
});
