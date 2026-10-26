import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
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
const { updateUserMock, toggleStatusMock, deleteUserMock } = vi.hoisted(() => ({
  updateUserMock: vi.fn(),
  toggleStatusMock: vi.fn(),
  deleteUserMock: vi.fn(),
}));
vi.mock("@/hooks/mutations/admin/use-update-admin-user", () => ({
  default: () => ({ mutateAsync: updateUserMock, isPending: false }),
}));
vi.mock("@/hooks/mutations/admin/use-toggle-admin-user-status", () => ({
  default: () => ({ mutateAsync: toggleStatusMock, isPending: false }),
}));
vi.mock("@/hooks/mutations/admin/use-delete-admin-user", () => ({
  default: () => ({ mutateAsync: deleteUserMock, isPending: false }),
}));
const { credentialMocks } = vi.hoisted(() => ({
  credentialMocks: {
    sendPasswordReset: vi.fn(),
    sendVerification: vi.fn(),
    markEmailVerified: vi.fn(),
    createUser: vi.fn(),
  },
}));
vi.mock("@/hooks/mutations/admin/use-send-admin-user-password-reset", () => ({
  default: () => ({
    mutateAsync: credentialMocks.sendPasswordReset,
    isPending: false,
  }),
}));
vi.mock(
  "@/hooks/mutations/admin/use-send-admin-user-verification-email",
  () => ({
    default: () => ({
      mutateAsync: credentialMocks.sendVerification,
      isPending: false,
    }),
  }),
);
vi.mock("@/hooks/mutations/admin/use-mark-admin-user-email-verified", () => ({
  default: () => ({
    mutateAsync: credentialMocks.markEmailVerified,
    isPending: false,
  }),
}));
vi.mock("@/hooks/mutations/admin/use-create-admin-user", () => ({
  default: () => ({
    mutateAsync: credentialMocks.createUser,
    isPending: false,
  }),
}));
vi.mock("@/hooks/mutations/admin/use-set-admin-user-avatar", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/mutations/admin/use-remove-admin-user-avatar", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const { configMock } = vi.hoisted(() => ({
  configMock: {
    data: { hasSmtp: true, disableLoginForm: false } as Record<string, unknown>,
  },
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => configMock,
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
    lastActiveAt: null,
    signInMethods: ["credential"],
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

function openRowMenu() {
  fireEvent.click(
    screen.getByRole("button", { name: "settings:adminUsers.actions.open" }),
  );
}

function openEditDialog() {
  openRowMenu();
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
  toggleStatusMock.mockReset();
  toggleStatusMock.mockResolvedValue(undefined);
  deleteUserMock.mockReset();
  deleteUserMock.mockResolvedValue(undefined);
  for (const mock of Object.values(credentialMocks)) {
    mock.mockReset();
    mock.mockResolvedValue(undefined);
  }
  configMock.data = { hasSmtp: true, disableLoginForm: false };
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

    const badges = screen.getAllByText("settings:adminUsers.roles.admin");
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      expect(badge.closest('[data-slot="badge"]')).not.toBeNull();
    }

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

  it("shows the total next to the title and the match count while searching", () => {
    useAdminUsersMock.mockReturnValue(success(128));
    render(<UserManagementPanel />);
    expect(screen.getByText("128")).toBeTruthy();

    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "settings:adminUsers.searchLabel",
      }),
      { target: { value: "ada" } },
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("settings:adminUsers.searchCount")).toBeTruthy();
    expect(useAdminUsersMock.mock.calls.at(-1)?.[0]).toBe("ada");
  });

  it("offers to clear an empty search", () => {
    useAdminUsersMock.mockReturnValue(success(0, []));
    render(<UserManagementPanel />);
    fireEvent.change(
      screen.getByRole("searchbox", {
        name: "settings:adminUsers.searchLabel",
      }),
      { target: { value: "nobody" } },
    );

    expect(screen.getByText("settings:adminUsers.emptyTitle")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "settings:adminUsers.next" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "settings:adminUsers.clearSearch" }),
    );

    expect(
      (
        screen.getByRole("searchbox", {
          name: "settings:adminUsers.searchLabel",
        }) as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("retries after a failed load", () => {
    const result = failure();
    useAdminUsersMock.mockReturnValue(result);
    render(<UserManagementPanel />);

    fireEvent.click(
      screen.getByRole("button", { name: "settings:adminUsers.retry" }),
    );

    expect(result.refetch).toHaveBeenCalledTimes(1);
  });

  it("only offers editing on your own account", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(
      success(1, [user({ id: "current-user" })]),
    );
    render(<UserManagementPanel />);

    expect(screen.getByText("settings:adminUsers.you")).toBeTruthy();
    openRowMenu();

    expect(
      await screen.findByRole("menuitem", {
        name: "settings:adminUsers.actions.edit",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("menuitem", {
        name: "settings:adminUsers.actions.deactivate",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "common:actions.delete" }),
    ).toBeNull();
  });

  it("deactivates an account only after confirmation", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(success(1));
    render(<UserManagementPanel />);

    openRowMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "settings:adminUsers.actions.deactivate",
      }),
    );
    expect(toggleStatusMock).not.toHaveBeenCalled();

    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:adminUsers.confirm.deactivate.action",
      }),
    );

    await waitFor(() =>
      expect(toggleStatusMock).toHaveBeenCalledWith({
        userId: "user-1",
        deactivate: true,
      }),
    );
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it("offers reactivation for a deactivated account", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(success(1, [user({ banned: true })]));
    render(<UserManagementPanel />);

    expect(
      screen.getAllByText("settings:adminUsers.status.deactivated").length,
    ).toBeGreaterThan(0);
    openRowMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "settings:adminUsers.actions.reactivate",
      }),
    );
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:adminUsers.confirm.reactivate.action",
      }),
    );

    await waitFor(() =>
      expect(toggleStatusMock).toHaveBeenCalledWith({
        userId: "user-1",
        deactivate: false,
      }),
    );
  });

  it("deletes an account only after confirmation", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(success(1));
    render(<UserManagementPanel />);

    openRowMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "common:actions.delete" }),
    );
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:adminUsers.confirm.delete.action",
      }),
    );

    await waitFor(() => expect(deleteUserMock).toHaveBeenCalledWith("user-1"));
    expect(toggleStatusMock).not.toHaveBeenCalled();
  });

  it("sends a password reset link only after confirmation", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(success(1));
    render(<UserManagementPanel />);

    openRowMenu();
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "settings:adminUsers.actions.sendPasswordReset",
      }),
    );
    expect(credentialMocks.sendPasswordReset).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:adminUsers.confirm.sendPasswordReset.action",
      }),
    );

    await waitFor(() =>
      expect(credentialMocks.sendPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({ id: "user-1", email: "ada@example.com" }),
      ),
    );
  });

  it("hides reset links when password sign-in is off", async () => {
    vi.useRealTimers();
    configMock.data = { hasSmtp: true, disableLoginForm: true };
    useAdminUsersMock.mockReturnValue(success(1));
    render(<UserManagementPanel />);

    openRowMenu();
    await screen.findByRole("menuitem", {
      name: "settings:adminUsers.actions.edit",
    });
    expect(
      screen.queryByRole("menuitem", {
        name: "settings:adminUsers.actions.sendPasswordReset",
      }),
    ).toBeNull();
  });

  it("offers verification actions for an unverified address", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(
      success(1, [user({ emailVerified: false })]),
    );
    render(<UserManagementPanel />);

    expect(screen.getByText("settings:adminUsers.unverified")).toBeTruthy();
    openRowMenu();
    expect(
      await screen.findByRole("menuitem", {
        name: "settings:adminUsers.actions.sendVerification",
      }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: "settings:adminUsers.actions.markEmailVerified",
      }),
    );
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:adminUsers.confirm.markEmailVerified.action",
      }),
    );

    await waitFor(() =>
      expect(credentialMocks.markEmailVerified).toHaveBeenCalledWith(
        expect.objectContaining({ id: "user-1" }),
      ),
    );
    expect(credentialMocks.sendVerification).not.toHaveBeenCalled();
  });

  it("passes filters to the query and returns to the first page", async () => {
    useAdminUsersMock.mockReturnValue(success(60));
    render(<UserManagementPanel />);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    goToThirdPage();
    vi.useRealTimers();

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "settings:adminUsers.filters.status",
      }),
      { detail: 1 },
    );
    const option = await screen.findByRole("option", {
      name: "settings:adminUsers.status.deactivated",
    });
    fireEvent.pointerDown(option);
    fireEvent.mouseDown(option);
    fireEvent.pointerUp(option);
    fireEvent.mouseUp(option);
    fireEvent.click(option, { detail: 1 });

    await waitFor(() =>
      expect(useAdminUsersMock.mock.calls.at(-1)?.[2]).toEqual({
        status: "deactivated",
      }),
    );
    expect(lastPageArgument()).toBe(0);
  });

  it("creates a user without asking for a password", async () => {
    vi.useRealTimers();
    useAdminUsersMock.mockReturnValue(success(1));
    render(<UserManagementPanel />);

    fireEvent.click(
      screen.getByRole("button", { name: "settings:adminUsers.create.open" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("settings:adminUsers.create.hintEmail"),
    ).toBeTruthy();
    expect(dialog.querySelector('input[type="password"]')).toBeNull();
    fireEvent.change(
      within(dialog).getByLabelText("settings:adminUsers.edit.name"),
      { target: { value: " Nora New " } },
    );
    fireEvent.change(
      within(dialog).getByLabelText("settings:adminUsers.edit.email"),
      { target: { value: "Nora@Example.com" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:adminUsers.create.submit",
      }),
    );

    await waitFor(() =>
      expect(credentialMocks.createUser).toHaveBeenCalledWith({
        name: "Nora New",
        email: "nora@example.com",
        role: "user",
      }),
    );
  });

  it("explains single sign-on accounts when password registration is off", async () => {
    vi.useRealTimers();
    configMock.data = { hasSmtp: true, disablePasswordRegistration: true };
    useAdminUsersMock.mockReturnValue(success(1));
    render(<UserManagementPanel />);

    fireEvent.click(
      screen.getByRole("button", { name: "settings:adminUsers.create.open" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("settings:adminUsers.create.hintSso"),
    ).toBeTruthy();
  });
});
