import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAdminUsers, {
  type AdminUser,
} from "@/hooks/queries/admin/use-admin-users";
import UserManagementPanel from "./user-management-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "current-user" } }),
}));
vi.mock("@/hooks/queries/admin/use-admin-users", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/hooks/queries/admin/use-admin-users")
  >()),
  default: vi.fn(),
}));
vi.mock("@/hooks/mutations/admin/use-update-admin-user", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/mutations/admin/use-toggle-admin-user-status", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/mutations/admin/use-delete-admin-user", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const useAdminUsersMock = vi.mocked(useAdminUsers);

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "user-1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    emailVerified: true,
    image: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    role: "user",
    banned: false,
    banReason: null,
    banExpires: null,
    ...overrides,
  };
}

function success(total: number, users: AdminUser[] = [user()]) {
  return {
    data: { users, total },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAdminUsers>;
}

function failure() {
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: true,
    error: new Error("x"),
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAdminUsers>;
}

function lastPageArgument() {
  const call = useAdminUsersMock.mock.calls.at(-1);
  return call?.[1];
}

function goToThirdPage() {
  const next = screen.getByRole("button", { name: "settings:adminUsers.next" });
  fireEvent.click(next);
  fireEvent.click(next);
  expect(lastPageArgument()).toBe(2);
}

beforeEach(() => {
  vi.useFakeTimers();
  useAdminUsersMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("UserManagementPanel", () => {
  it("keeps the current page when the query fails", () => {
    useAdminUsersMock.mockReturnValue(success(60));
    const view = render(<UserManagementPanel />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    goToThirdPage();

    useAdminUsersMock.mockReturnValue(failure());
    view.rerender(<UserManagementPanel />);

    expect(screen.getByText("settings:adminUsers.loadError")).toBeTruthy();
    expect(lastPageArgument()).toBe(2);
  });

  it("clamps an out-of-range page once a smaller result set arrives", () => {
    useAdminUsersMock.mockReturnValue(success(60));
    const view = render(<UserManagementPanel />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    goToThirdPage();

    useAdminUsersMock.mockReturnValue(success(20));
    view.rerender(<UserManagementPanel />);

    expect(lastPageArgument()).toBe(0);
  });

  it("treats a comma-separated role containing admin as an instance admin", () => {
    useAdminUsersMock.mockReturnValue(
      success(1, [user({ role: "user,admin" })]),
    );
    render(<UserManagementPanel />);

    const badge = screen.getByText("settings:adminUsers.roles.admin");
    expect(badge.closest('[data-slot="badge"]')).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "settings:adminUsers.actions.open" }),
    );
    fireEvent.click(screen.getByText("settings:adminUsers.actions.edit"));

    const trigger = document.getElementById("admin-user-role");
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toContain("settings:adminUsers.roles.admin");
    expect(trigger?.textContent).not.toContain(
      "settings:adminUsers.roles.user",
    );
  });
});
