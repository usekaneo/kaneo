import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { AdminOverview } from "@/fetchers/admin/overview-types";
import useAdminOverview from "@/hooks/queries/admin/use-admin-overview";
import AdminOverviewPanel from "./admin-overview-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/queries/admin/use-admin-overview", () => ({
  default: vi.fn(),
}));

const data: AdminOverview = {
  users: { total: 12, activeLast30Days: 7, deactivated: 2 },
  workspaces: { total: 4, archived: 1 },
  recentUsers: [
    {
      id: "u1",
      name: "Alex",
      email: "alex@example.com",
      image: null,
      createdAt: "2026-10-27T09:30:00Z",
    },
  ],
  recentActions: [
    {
      id: "a1",
      createdAt: "2026-10-27T09:30:00Z",
      action: "user.created",
      actor: { id: "admin", name: "Sam", email: "sam@example.com" },
      targetType: "user",
      targetId: "u1",
      targetLabel: "Alex",
    },
  ],
  services: {
    checkedAt: "2026-10-27T09:30:00Z",
    api: "ok",
    database: "ok",
    realtime: "ok",
    redis: "not_configured",
    email: "down",
    storage: "warning",
  },
  warnings: ["smtp_unreachable", "no_second_admin"],
};
function mockOverview(value: Partial<ReturnType<typeof useAdminOverview>>) {
  const refetch = vi.fn();
  vi.mocked(useAdminOverview).mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch,
    ...value,
  } as unknown as ReturnType<typeof useAdminOverview>);
  return refetch;
}
afterEach(cleanup);

describe("AdminOverviewPanel", () => {
  it("shows loading placeholders and disables refresh while checking", () => {
    mockOverview({ isLoading: true, isFetching: true });
    render(<AdminOverviewPanel />);
    expect(screen.getAllByTestId("settings-row-skeleton")).toHaveLength(5);
    expect(screen.getByRole("button", { name: /refreshing/ })).toBeDisabled();
    expect(screen.queryByText("settings:adminOverview.totalUsers")).toBeNull();
  });
  it("offers a retry on failure", () => {
    const refetch = mockOverview({ isError: true });
    render(<AdminOverviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /retry/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("settings:adminOverview.loadError")).toBeTruthy();
  });
  it("shows counts, recent data, service statuses, actionable warnings and directory links", () => {
    const refetch = mockOverview({ data });
    render(<AdminOverviewPanel />);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("alex@example.com")).toBeTruthy();
    expect(screen.getByText("Sam")).toBeTruthy();
    expect(
      screen.getByText("settings:adminAuditLog.actions.userCreated"),
    ).toBeTruthy();
    expect(screen.getByText("settings:adminSystem.status.down")).toBeTruthy();
    expect(screen.getByRole("link", { name: /viewUsers/ })).toHaveAttribute(
      "href",
      "/dashboard/settings/admin/users",
    );
    expect(screen.getByRole("link", { name: /viewAuditLog/ })).toHaveAttribute(
      "href",
      "/dashboard/settings/admin/audit-log",
    );
    expect(screen.getByRole("link", { name: /viewSystem/ })).toHaveAttribute(
      "href",
      "/dashboard/settings/admin/system",
    );
    expect(screen.getByRole("link", { name: /noSecondAdmin/ })).toHaveAttribute(
      "href",
      "/dashboard/settings/admin/users",
    );
    fireEvent.click(screen.getByRole("button", { name: /refresh$/ }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
  it("shows empty lists and hides the warnings section when there are no warnings", () => {
    mockOverview({
      data: { ...data, warnings: [], recentUsers: [], recentActions: [] },
    });
    render(<AdminOverviewPanel />);
    expect(screen.getByText("settings:adminOverview.noUsers")).toBeTruthy();
    expect(screen.getByText("settings:adminOverview.noActions")).toBeTruthy();
    expect(
      screen.queryByText("settings:adminOverview.configurationWarnings"),
    ).toBeNull();
  });
});
