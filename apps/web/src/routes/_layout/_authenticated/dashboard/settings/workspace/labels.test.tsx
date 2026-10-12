import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentType } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { Route } from "./labels";

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));

type TestLabel = {
  id: string;
  name: string;
  color: string;
  taskId: string | null;
  deletionStartedAt: string | null;
};

const m = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  labels: [] as TestLabel[],
  isPending: false,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    workspace: { id: "workspace", name: "Workspace" },
    canCreateLabels: () => m.canCreate,
    canUpdateLabels: () => m.canUpdate,
    canDeleteLabels: () => m.canDelete,
  }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({
    data: m.isPending ? undefined : m.labels,
    isPending: m.isPending,
    isError: false,
  }),
}));
vi.mock("@/hooks/mutations/label/use-create-label", () => ({
  default: () => ({ mutateAsync: m.create, isPending: false }),
}));
vi.mock("@/hooks/mutations/label/use-update-label", () => ({
  default: () => ({ mutateAsync: m.update, isPending: false }),
}));
vi.mock("@/hooks/mutations/label/use-delete-label", () => ({
  default: () => ({ mutateAsync: m.remove, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: m.error },
}));

const Component = Route.options.component as ComponentType;

const bug: TestLabel = {
  id: "bug",
  name: "Bug",
  color: "red",
  taskId: null,
  deletionStartedAt: null,
};
const removing: TestLabel = {
  id: "root",
  name: "Old",
  color: "gray",
  taskId: null,
  deletionStartedAt: "2026-09-19T12:00:00Z",
};

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  m.labels = [bug];
  m.isPending = false;
  m.canCreate = true;
  m.canUpdate = true;
  m.canDelete = true;
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function openRowMenu(name: string) {
  fireEvent.click(
    screen.getByRole("button", { name: "settings:workspaceLabels.rowActions" }),
  );
  return screen.findByRole("menuitem", { name });
}

describe("workspace labels list", () => {
  it("shows skeleton rows instead of the empty state while loading", () => {
    m.isPending = true;
    render(<Component />);
    expect(screen.getAllByTestId("settings-row-skeleton")).toHaveLength(3);
    expect(
      screen.queryByText("settings:workspaceLabels.emptyTitle"),
    ).not.toBeInTheDocument();
  });

  it("shows the empty state with a create action only when allowed", () => {
    m.labels = [];
    const { unmount } = render(<Component />);
    expect(
      screen.getByText("settings:workspaceLabels.emptyTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", {
        name: "settings:workspaceLabels.newLabel",
      }),
    ).toHaveLength(2);
    unmount();

    m.canCreate = false;
    render(<Component />);
    expect(
      screen.queryByRole("button", {
        name: "settings:workspaceLabels.newLabel",
      }),
    ).not.toBeInTheDocument();
  });

  it("hides task-level label copies and the row menu without permissions", () => {
    m.labels = [bug, { ...bug, id: "copy", taskId: "task-1" }];
    m.canUpdate = false;
    m.canDelete = false;
    render(<Component />);
    expect(screen.getAllByText("Bug")).toHaveLength(1);
    expect(
      screen.queryByRole("button", {
        name: "settings:workspaceLabels.rowActions",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "settings:workspaceLabels.editNamed",
      }),
    ).not.toBeInTheDocument();
  });
});

describe("creating and editing labels", () => {
  it("requires a name and creates the label with the chosen color", async () => {
    m.create.mockResolvedValue({ id: "new" });
    render(<Component />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:workspaceLabels.newLabel" }),
    );
    const dialog = await screen.findByRole("dialog");
    const form = dialog.querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);
    expect(
      within(dialog).getByText("settings:workspaceLabels.nameRequired"),
    ).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();

    fireEvent.change(
      within(dialog).getByLabelText("settings:workspaceLabels.nameLabel"),
      { target: { value: "  Design  " } },
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Lavender" }));
    expect(
      within(dialog).getByRole("button", { name: "Lavender" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByText("Design")).toBeInTheDocument();
    fireEvent.submit(form);

    await waitFor(() =>
      expect(m.create).toHaveBeenCalledWith({
        name: "Design",
        color: "purple",
        workspaceId: "workspace",
      }),
    );
    expect(m.success).toHaveBeenCalledWith(
      "settings:workspaceLabels.createSuccess",
      { icon: expect.anything() },
    );
  });

  it("opens the edit dialog from the row menu and from the row itself", async () => {
    m.update.mockResolvedValue({ id: "bug" });
    render(<Component />);
    fireEvent.click(await openRowMenu("settings:workspaceLabels.editLabel"));
    let dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByLabelText("settings:workspaceLabels.nameLabel"),
    ).toHaveValue("Bug");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common:actions.cancel" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceLabels.editNamed",
      }),
    );
    dialog = await screen.findByRole("dialog");
    fireEvent.change(
      within(dialog).getByLabelText("settings:workspaceLabels.nameLabel"),
      { target: { value: "Defect" } },
    );
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    await waitFor(() =>
      expect(m.update).toHaveBeenCalledWith({
        id: "bug",
        name: "Defect",
        color: "red",
      }),
    );
  });
});

describe("deleting workspace labels", () => {
  it("asks for confirmation before deleting from the row menu", async () => {
    m.remove.mockResolvedValue({ id: "bug" });
    render(<Component />);
    fireEvent.click(await openRowMenu("settings:workspaceLabels.deleteLabel"));
    const dialog = await screen.findByRole("alertdialog");
    expect(m.remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:workspaceLabels.deleteLabel",
      }),
    );
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith({ id: "bug" }));
    expect(m.success).toHaveBeenCalledWith(
      "settings:workspaceLabels.deleteSuccess",
      { icon: expect.anything() },
    );
  });

  it("shows persisted deletion state, prevents editing and resumes after confirmation", async () => {
    m.labels = [removing];
    m.remove.mockResolvedValue({ id: "root" });
    render(<Component />);
    expect(
      screen.getByText("settings:workspaceLabels.deletionPending"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "settings:workspaceLabels.rowActions",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "settings:workspaceLabels.editNamed",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceLabels.resumeDeletion",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:workspaceLabels.resumeDeletion",
      }),
    );
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith({ id: "root" }));
    await waitFor(() =>
      expect(m.success).toHaveBeenCalledWith(
        "settings:workspaceLabels.deleteSuccess",
        { icon: expect.anything() },
      ),
    );
  });

  it("keeps the confirmation available and never reports success on another connection failure", async () => {
    m.labels = [removing];
    m.remove.mockRejectedValue(new Error("Connection lost"));
    render(<Component />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceLabels.resumeDeletion",
      }),
    );
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "settings:workspaceLabels.resumeDeletion",
      }),
    );
    await waitFor(() =>
      expect(m.error).toHaveBeenCalledWith("Connection lost"),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(m.success).not.toHaveBeenCalled();
  });
});
