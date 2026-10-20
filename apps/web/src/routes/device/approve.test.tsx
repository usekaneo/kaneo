import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => {
  const device = Object.assign(vi.fn(), { approve: vi.fn(), deny: vi.fn() });
  return {
    device,
    session: { data: null as unknown, isPending: false },
    search: { user_code: "wdjb-mjht" } as { user_code?: string },
    navigate: vi.fn(),
  };
});
vi.mock("@/lib/auth-client", () => ({
  authClient: { device: m.device, useSession: () => m.session },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => m.search,
  useNavigate: () => m.navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

const { Route } = await import("./approve");
const Page = Route.options.component as ComponentType;

beforeEach(() => {
  vi.clearAllMocks();
  m.session = {
    data: { user: { email: "person@example.com" } },
    isPending: false,
  };
  m.search = { user_code: "wdjb-mjht" };
  m.device.mockResolvedValue({ data: {}, error: null });
  m.device.approve.mockResolvedValue({ data: {}, error: null });
  m.device.deny.mockResolvedValue({ data: {}, error: null });
});
afterEach(cleanup);

it("shows the normalized code and confirms the approval in place", async () => {
  render(<Page />);
  expect(screen.getByText("WDJB-MJHT")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "auth:device.approve.approve" }),
  );
  await waitFor(() =>
    expect(m.device.approve).toHaveBeenCalledWith({ userCode: "WDJBMJHT" }),
  );
  expect(m.device).toHaveBeenCalledWith({ query: { user_code: "WDJBMJHT" } });
  expect(
    await screen.findByText("auth:device.approved.description"),
  ).toHaveAttribute("role", "status");
  expect(m.navigate).not.toHaveBeenCalled();
});

it("confirms a denied request without connecting anything", async () => {
  render(<Page />);
  fireEvent.click(
    screen.getByRole("button", { name: "auth:device.approve.deny" }),
  );
  expect(
    await screen.findByText("auth:device.denied.description"),
  ).toHaveAttribute("role", "status");
  expect(m.device.approve).not.toHaveBeenCalled();
});

it("keeps the request open when the server rejects the decision", async () => {
  m.device.approve.mockResolvedValue({
    data: null,
    error: { error_description: "Invalid user code" },
  });
  render(<Page />);
  const approve = screen.getByRole("button", {
    name: "auth:device.approve.approve",
  });
  fireEvent.click(approve);
  await waitFor(() => expect(approve).not.toBeDisabled());
  expect(screen.queryByText("auth:device.approved.description")).toBeNull();
});

it("sends signed-out visitors to sign in and back to this request", () => {
  m.session = { data: null, isPending: false };
  render(<Page />);
  fireEvent.click(
    screen.getByRole("button", { name: "auth:device.signIn.submit" }),
  );
  expect(m.navigate).toHaveBeenCalledWith({
    to: "/auth/sign-in",
    search: { redirect: "/device/approve?user_code=WDJBMJHT" },
  });
});
