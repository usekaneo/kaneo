import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => ({
  request: {} as Record<string, unknown>,
  mutate: vi.fn(),
  session: { data: null as unknown, isPending: false },
  search: { request_id: "request-1" } as { request_id?: string },
}));
vi.mock("@/hooks/queries/mcp/use-authorization-request", () => ({
  useMcpAuthorizationRequest: () => m.request,
}));
vi.mock("@/hooks/mutations/mcp/use-authorization-decision", () => ({
  useMcpAuthorizationDecision: () => ({
    mutate: m.mutate,
    isPending: false,
    variables: undefined,
  }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => m.session },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useSearch: () => m.search,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { Route } = await import("./mcp.authorize");
const Page = Route.options.component as ComponentType;

beforeEach(() => {
  vi.clearAllMocks();
  m.search = { request_id: "request-1" };
  m.session = {
    data: { user: { email: "person@example.com" } },
    isPending: false,
  };
  m.request = {
    isError: false,
    isLoading: false,
    data: {
      clientName: "Claude Desktop",
      redirectUri: "http://127.0.0.1:53682/callback",
    },
  };
});
afterEach(cleanup);

it("shows who is asking, where it returns, and which account it gets", () => {
  render(<Page />);
  expect(screen.getByText("Claude Desktop")).toBeInTheDocument();
  expect(
    screen.getByText("auth:mcp.authorize.selfReported"),
  ).toBeInTheDocument();
  expect(
    screen.getByText("http://127.0.0.1:53682/callback"),
  ).toBeInTheDocument();
  expect(screen.getByText("person@example.com")).toBeInTheDocument();
});

it.each([
  ["auth:mcp.authorize.allow", true],
  ["auth:mcp.authorize.deny", false],
])("submits %s as approved=%s", (label, approved) => {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: label }));
  expect(m.mutate).toHaveBeenCalledWith(
    { requestId: "request-1", approved },
    expect.any(Object),
  );
});

it.each([
  [{ request_id: undefined }, {}],
  [{ request_id: "request-1" }, { isError: true }],
])("explains an unusable request %j %j", (search, request) => {
  m.search = search;
  m.request = { ...m.request, ...request };
  render(<Page />);
  expect(screen.getByText("auth:mcp.expired.title")).toBeInTheDocument();
  expect(screen.queryByRole("button")).toBeNull();
});
