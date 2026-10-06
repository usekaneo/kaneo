import {
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
import type {
  AdminWorkspace,
  AdminWorkspaceMember,
} from "@/fetchers/admin/workspace-types";
import useAdminWorkspaceMembers from "@/hooks/queries/admin/use-admin-workspace-members";
import useAdminWorkspaces from "@/hooks/queries/admin/use-admin-workspaces";
import WorkspaceManagementPanel from "./workspace-management-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}|${options.name}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "current-user" } }),
}));
vi.mock(
  "@/hooks/queries/admin/use-admin-workspaces",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/hooks/queries/admin/use-admin-workspaces")
    >()),
    default: vi.fn(),
  }),
);
vi.mock("@/hooks/queries/admin/use-admin-workspace-members", () => ({
  default: vi.fn(),
}));
vi.mock("@/hooks/queries/admin/use-admin-workspace-roles", () => ({
  default: () => ({ data: ["viewer", "member", "admin", "Designer"] }),
}));
vi.mock("@/hooks/queries/admin/use-admin-users", () => ({
  ADMIN_USERS_SEARCH_MAX_LENGTH: 200,
  default: () => ({
    data: {
      users: [
        {
          id: "linus",
          name: "Linus Torvalds",
          email: "linus@example.com",
        },
      ],
      total: 1,
    },
    isFetching: false,
    isError: false,
  }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-workspace-project-access",
  () => ({
    default: () => ({ data: [{ userId: "grace", projectIds: ["p1", "p2"] }] }),
  }),
);
vi.mock("@/components/team/member-project-access-dialog", () => ({
  default: ({
    open,
    member,
    access,
  }: {
    open: boolean;
    member: { name: string } | null;
    access: { projectAccess: string; projectIds: string[] };
  }) =>
    open ? (
      <div data-testid="project-access-dialog">
        {`${member?.name}:${access.projectAccess}:${access.projectIds.length}`}
      </div>
    ) : null,
}));

const mocks = vi.hoisted(() => ({
  updateRole: vi.fn(),
  remove: vi.fn(),
  transfer: vi.fn(),
  add: vi.fn(),
}));
vi.mock(
  "@/hooks/mutations/admin/use-update-admin-workspace-member-role",
  () => ({
    default: () => ({
      mutate: mocks.updateRole,
      isPending: false,
      variables: undefined,
    }),
  }),
);
vi.mock("@/hooks/mutations/admin/use-remove-admin-workspace-member", () => ({
  default: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));
vi.mock(
  "@/hooks/mutations/admin/use-transfer-admin-workspace-ownership",
  () => ({
    default: () => ({ mutateAsync: mocks.transfer, isPending: false }),
  }),
);
vi.mock("@/hooks/mutations/admin/use-add-admin-workspace-member", () => ({
  default: () => ({ mutateAsync: mocks.add, isPending: false }),
}));

const useAdminWorkspacesMock = vi.mocked(useAdminWorkspaces);
const useAdminWorkspaceMembersMock = vi.mocked(useAdminWorkspaceMembers);

const acme: AdminWorkspace = {
  id: "acme",
  name: "Acme",
  slug: "acme-inc",
  createdAt: "2026-01-01T00:00:00.000Z",
  memberCount: 2,
  projectCount: 4,
  owners: [{ id: "ada", name: "Ada Lovelace", email: "ada@example.com" }],
};

const orphan: AdminWorkspace = {
  id: "orphan",
  name: "Orphaned",
  slug: "orphaned",
  createdAt: "2026-01-01T00:00:00.000Z",
  memberCount: 1,
  projectCount: 0,
  owners: [],
};

function member(
  overrides: Partial<AdminWorkspaceMember> = {},
): AdminWorkspaceMember {
  return {
    userId: "grace",
    name: "Grace Hopper",
    email: "grace@example.com",
    image: null,
    role: "member",
    joinedAt: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

const members = [
  member(),
  member({
    userId: "ada",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "owner",
  }),
];

function workspacesResult(workspaces: AdminWorkspace[]) {
  return {
    data: { workspaces, total: workspaces.length },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAdminWorkspaces>;
}

function membersResult(list: AdminWorkspaceMember[]) {
  return {
    data: list,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAdminWorkspaceMembers>;
}

function openAcme() {
  render(<WorkspaceManagementPanel />);
  fireEvent.click(
    screen.getByRole("button", {
      name: "settings:adminWorkspaces.manageLabel|Acme",
    }),
  );
  return screen.findByRole("dialog", {
    name: "settings:adminWorkspaces.members.title|Acme",
  });
}

function openMemberMenu(name: string) {
  fireEvent.click(
    screen.getByRole("button", {
      name: `settings:adminWorkspaces.members.actions|${name}`,
    }),
  );
}

function choose(option: HTMLElement) {
  fireEvent.pointerDown(option);
  fireEvent.mouseDown(option);
  fireEvent.pointerUp(option);
  fireEvent.mouseUp(option);
  fireEvent.click(option, { detail: 1 });
}

beforeEach(() => {
  useAdminWorkspacesMock.mockReset();
  useAdminWorkspacesMock.mockReturnValue(workspacesResult([acme, orphan]));
  useAdminWorkspaceMembersMock.mockReset();
  useAdminWorkspaceMembersMock.mockReturnValue(membersResult(members));
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
    mock.mockResolvedValue(members);
  }
});

afterEach(() => {
  cleanup();
});

describe("WorkspaceManagementPanel", () => {
  it("lists workspaces with their owners and counts", () => {
    render(<WorkspaceManagementPanel />);

    const acmeRow = screen.getByText("Acme").closest("tr") as HTMLElement;
    expect(within(acmeRow).getByText("acme-inc")).toBeTruthy();
    expect(within(acmeRow).getByText("Ada Lovelace")).toBeTruthy();
    expect(within(acmeRow).getByText("2")).toBeTruthy();
    expect(within(acmeRow).getByText("4")).toBeTruthy();

    const orphanRow = screen.getByText("Orphaned").closest("tr") as HTMLElement;
    expect(
      within(orphanRow).getByText("settings:adminWorkspaces.noOwner"),
    ).toBeTruthy();
  });

  it("shows the empty state when nothing matches", () => {
    useAdminWorkspacesMock.mockReturnValue(workspacesResult([]));
    render(<WorkspaceManagementPanel />);

    expect(
      screen.getByText("settings:adminWorkspaces.emptyTitle"),
    ).toBeTruthy();
  });

  it("opens a workspace's members with owners first", async () => {
    const dialog = await openAcme();

    expect(useAdminWorkspaceMembersMock).toHaveBeenLastCalledWith("acme", true);
    const rows = within(dialog).getAllByRole("row").slice(1);
    expect(rows[0]?.textContent).toContain("Ada Lovelace");
    expect(
      within(rows[0] as HTMLElement).getByText("team:roles.owner"),
    ).toBeTruthy();
    expect(rows[1]?.textContent).toContain("Grace Hopper");
    expect(
      within(dialog).getByRole("combobox", {
        name: "settings:adminWorkspaces.members.roleLabel|Grace Hopper",
      }),
    ).toBeTruthy();
    expect(
      within(dialog).queryByRole("combobox", {
        name: "settings:adminWorkspaces.members.roleLabel|Ada Lovelace",
      }),
    ).toBeNull();
  });

  it("transfers ownership after confirmation", async () => {
    await openAcme();
    openMemberMenu("Grace Hopper");
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "settings:adminWorkspaces.members.makeOwner",
      }),
    );

    const confirm = await screen.findByRole("alertdialog");
    expect(
      within(confirm).getByText(
        "settings:adminWorkspaces.confirm.transfer.description|Grace Hopper",
      ),
    ).toBeTruthy();
    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:adminWorkspaces.confirm.transfer.action",
      }),
    );

    await waitFor(() =>
      expect(mocks.transfer).toHaveBeenCalledWith({
        workspaceId: "acme",
        userId: "grace",
      }),
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("removes a member after confirmation", async () => {
    await openAcme();
    openMemberMenu("Grace Hopper");
    fireEvent.click(
      await screen.findByRole("menuitem", {
        name: "settings:adminWorkspaces.members.remove",
      }),
    );

    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:adminWorkspaces.confirm.remove.action",
      }),
    );

    await waitFor(() =>
      expect(mocks.remove).toHaveBeenCalledWith({
        workspaceId: "acme",
        userId: "grace",
      }),
    );
    expect(mocks.transfer).not.toHaveBeenCalled();
  });

  it("offers no member actions for the only owner", async () => {
    const dialog = await openAcme();

    expect(
      within(dialog).queryByRole("button", {
        name: "settings:adminWorkspaces.members.actions|Ada Lovelace",
      }),
    ).toBeNull();
    expect(
      within(dialog).getByRole("button", {
        name: "settings:adminWorkspaces.members.actions|Grace Hopper",
      }),
    ).toBeTruthy();
  });

  it("changes a member's role", async () => {
    const dialog = await openAcme();
    fireEvent.click(
      within(dialog).getByRole("combobox", {
        name: "settings:adminWorkspaces.members.roleLabel|Grace Hopper",
      }),
      { detail: 1 },
    );
    choose(await screen.findByRole("option", { name: "Designer" }));

    await waitFor(() =>
      expect(mocks.updateRole).toHaveBeenCalledWith({
        workspaceId: "acme",
        userId: "grace",
        role: "Designer",
      }),
    );
  });

  it("opens project access with the member's current access", async () => {
    const dialog = await openAcme();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:adminWorkspaces.members.editAccess|Grace Hopper",
      }),
    );

    expect(
      (await screen.findByTestId("project-access-dialog")).textContent,
    ).toBe("Grace Hopper:selected:2");
  });

  it("adds an instance user with the chosen role", async () => {
    const dialog = await openAcme();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:adminWorkspaces.members.add",
      }),
    );

    const addDialog = await screen.findByRole("dialog", {
      name: "settings:adminWorkspaces.addMember.title",
    });
    const input = within(addDialog)
      .getAllByLabelText("settings:adminWorkspaces.addMember.user")
      .find((element) => element.tagName === "INPUT") as HTMLElement;
    fireEvent.change(input, { target: { value: "lin" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.click(
      await screen.findByRole("option", { name: /Linus Torvalds/ }),
      { detail: 1 },
    );

    fireEvent.click(
      within(addDialog).getByRole("button", {
        name: "settings:adminWorkspaces.addMember.submit",
      }),
    );

    await waitFor(() =>
      expect(mocks.add).toHaveBeenCalledWith({
        workspaceId: "acme",
        userId: "linus",
        role: "member",
      }),
    );
  });
});
