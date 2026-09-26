import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
const { updateUserMock } = vi.hoisted(() => ({
  updateUserMock: vi.fn(),
}));
vi.mock("@/hooks/mutations/admin/use-update-admin-user", () => ({
  default: () => ({ mutateAsync: updateUserMock, isPending: false }),
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

function openEditDialog() {
  fireEvent.click(
    screen.getByRole("button", { name: "settings:adminUsers.actions.open" }),
  );
  fireEvent.click(screen.getByText("settings:adminUsers.actions.edit"));
  const trigger = document.getElementById("admin-user-role");
  expect(trigger).not.toBeNull();
  return trigger as HTMLElement;
}

async function selectRole(trigger: HTMLElement, role: "admin" | "user") {
  fireEvent.click(trigger, { detail: 1 });
  const option = await screen.findByRole("option", {
    name: `settings:adminUsers.roles.${role}`,
  });
  fireEvent.pointerDown(option);
  fireEvent.mouseDown(option);
  fireEvent.pointerUp(option);
  fireEvent.mouseUp(option);
  fireEvent.click(option, { detail: 1 });
}

function submitEdit() {
  fireEvent.click(
    screen.getByRole("button", { name: "settings:adminUsers.edit.save" }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  useAdminUsersMock.mockReset();
  updateUserMock.mockReset();
  updateUserMock.mockResolvedValue(undefined);
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

    const trigger = openEditDialog();
    expect(trigger.textContent).toContain("settings:adminUsers.roles.admin");
    expect(trigger.textContent).not.toContain("settings:adminUsers.roles.user");
  });

  it("omits the role when a multi-role account is edited without changing it", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(
      success(1, [user({ role: "user,admin" })]),
    );
    render(<UserManagementPanel />);

    openEditDialog();
    submitEdit();

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledTimes(1));
    expect(updateUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(updateUserMock.mock.calls[0]?.[0]).not.toHaveProperty("role");
  });

  it("strips only the admin token when a multi-role account is demoted", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(
      success(1, [user({ role: "user,admin" })]),
    );
    render(<UserManagementPanel />);

    const trigger = openEditDialog();
    await selectRole(trigger, "user");
    submitEdit();

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledTimes(1));
    expect(updateUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "user",
    });
  });

  it("appends the admin token when a plain user is promoted", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(success(1, [user({ role: "user" })]));
    render(<UserManagementPanel />);

    const trigger = openEditDialog();
    await selectRole(trigger, "admin");
    submitEdit();

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledTimes(1));
    expect(updateUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "user,admin",
    });
  });
});
