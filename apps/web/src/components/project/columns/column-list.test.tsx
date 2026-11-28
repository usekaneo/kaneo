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
import { ColumnList } from "@/components/project/columns/column-list";
import { toast } from "@/lib/toast";

const m = vi.hoisted(() => ({
  canUpdate: true,
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  deleteColumn: vi.fn(),
  reorderColumns: vi.fn(),
}));

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateProjects: () => m.canUpdate }),
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({
    isLoading: false,
    data: [
      {
        id: "c1",
        name: "To Do",
        slug: "to-do",
        icon: null,
        isFinal: false,
        position: 0,
      },
      {
        id: "c2",
        name: "Done",
        slug: "done",
        icon: null,
        isFinal: true,
        position: 1,
      },
    ],
  }),
}));
vi.mock("@/hooks/mutations/column/use-create-column", () => ({
  useCreateColumn: () => ({ mutateAsync: m.createColumn }),
}));
vi.mock("@/hooks/mutations/column/use-update-column", () => ({
  useUpdateColumn: () => ({ mutateAsync: m.updateColumn }),
}));
vi.mock("@/hooks/mutations/column/use-delete-column", () => ({
  useDeleteColumn: () => ({ mutateAsync: m.deleteColumn, isPending: false }),
}));
vi.mock("@/hooks/mutations/column/use-reorder-columns", () => ({
  useReorderColumns: () => ({ mutateAsync: m.reorderColumns }),
}));

describe("ColumnList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.canUpdate = true;
    for (const fn of [m.createColumn, m.updateColumn, m.deleteColumn]) {
      fn.mockResolvedValue({});
    }
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
  });
  afterEach(cleanup);

  it("renames on Enter and reverts a blank name without saving", async () => {
    render(<ColumnList projectId="p1" />);
    const [name] = screen.getAllByRole("textbox", {
      name: "settings:columnEditor.renameAria",
    }) as HTMLInputElement[];

    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.blur(name);
    expect(name.value).toBe("To Do");
    expect(m.updateColumn).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: "  Backlog " } });
    fireEvent.keyDown(name, { key: "Enter" });
    fireEvent.blur(name);
    await waitFor(() =>
      expect(m.updateColumn).toHaveBeenCalledWith({
        id: "c1",
        projectId: "p1",
        data: { name: "Backlog" },
      }),
    );
  });

  it("toggles the done column", async () => {
    render(<ColumnList projectId="p1" />);
    const [todoSwitch] = screen.getAllByRole("switch", {
      name: "settings:columnEditor.markDoneAria",
    });
    fireEvent.click(todoSwitch);
    await waitFor(() =>
      expect(m.updateColumn).toHaveBeenCalledWith({
        id: "c1",
        projectId: "p1",
        data: { isFinal: true },
      }),
    );
  });

  it("asks before deleting and keeps the error toast", async () => {
    m.deleteColumn.mockRejectedValue(
      new Error("Cannot delete column that contains tasks."),
    );
    render(<ColumnList projectId="p1" />);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "settings:columnEditor.deleteAria",
      })[0],
    );
    const confirm = await screen.findByRole("alertdialog");
    expect(
      within(confirm).getByText("settings:columnEditor.deleteDescription"),
    ).toBeInTheDocument();
    expect(m.deleteColumn).not.toHaveBeenCalled();

    fireEvent.click(
      within(confirm).getByRole("button", {
        name: "settings:columnEditor.deleteConfirm",
      }),
    );
    await waitFor(() =>
      expect(m.deleteColumn).toHaveBeenCalledWith({
        id: "c1",
        projectId: "p1",
      }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Cannot delete column that contains tasks.",
      ),
    );
  });

  it("adds a column from the inline row", async () => {
    render(<ColumnList projectId="p1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:columnEditor.addColumn" }),
    );
    const input = screen.getByRole("textbox", {
      name: "settings:columnEditor.newColumnPlaceholder",
    });
    fireEvent.change(input, { target: { value: " Review " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(m.createColumn).toHaveBeenCalledWith({
        projectId: "p1",
        data: { name: "Review", icon: "Circle" },
      }),
    );
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("saves a new column when focus leaves the inline row", async () => {
    render(<ColumnList projectId="p1" />);
    const addButton = { name: "settings:columnEditor.addColumn" };
    const inputName = { name: "settings:columnEditor.newColumnPlaceholder" };

    fireEvent.click(screen.getByRole("button", addButton));
    fireEvent.change(screen.getByRole("textbox", inputName), {
      target: { value: "  " },
    });
    fireEvent.blur(screen.getByRole("textbox", inputName));
    expect(screen.queryByRole("textbox", inputName)).toBeNull();

    fireEvent.click(screen.getByRole("button", addButton));
    fireEvent.change(screen.getByRole("textbox", inputName), {
      target: { value: "Draft" },
    });
    const draft = screen.getByRole("textbox", inputName);
    act(() => {
      fireEvent.keyDown(draft, { key: "Escape" });
      fireEvent.blur(draft);
    });
    expect(screen.queryByRole("textbox", inputName)).toBeNull();
    expect(m.createColumn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", addButton));
    const input = screen.getByRole("textbox", inputName);
    fireEvent.change(input, { target: { value: " Review " } });
    fireEvent.blur(input);
    await waitFor(() =>
      expect(m.createColumn).toHaveBeenCalledWith({
        projectId: "p1",
        data: { name: "Review", icon: "Circle" },
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("textbox", inputName)).toBeNull(),
    );
    expect(m.createColumn).toHaveBeenCalledTimes(1);
  });

  it("does not save twice on Enter followed by blur", async () => {
    let finish: (value: unknown) => void = () => {};
    m.createColumn.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<ColumnList projectId="p1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:columnEditor.addColumn" }),
    );
    const input = screen.getByRole("textbox", {
      name: "settings:columnEditor.newColumnPlaceholder",
    });
    fireEvent.change(input, { target: { value: "Review" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    finish({});
    await waitFor(() => expect(input).toHaveValue(""));
    fireEvent.blur(input);
    expect(m.createColumn).toHaveBeenCalledTimes(1);
  });

  it("keeps a new draft when an earlier save finishes after reopening", async () => {
    let finish: (value: unknown) => void = () => {};
    m.createColumn.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<ColumnList projectId="p1" />);
    const addButton = { name: "settings:columnEditor.addColumn" };
    const inputName = { name: "settings:columnEditor.newColumnPlaceholder" };

    fireEvent.click(screen.getByRole("button", addButton));
    const first = screen.getByRole("textbox", inputName);
    fireEvent.change(first, { target: { value: "Review" } });
    fireEvent.blur(first);
    expect(m.createColumn).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(first, { key: "Escape" });
    expect(screen.queryByRole("textbox", inputName)).toBeNull();

    fireEvent.click(screen.getByRole("button", addButton));
    const next = screen.getByRole("textbox", inputName);
    expect(next).not.toHaveAttribute("readonly");
    fireEvent.change(next, { target: { value: "Next" } });
    m.createColumn.mockReturnValue(new Promise(() => {}));
    fireEvent.keyDown(next, { key: "Enter" });
    expect(m.createColumn).toHaveBeenLastCalledWith({
      projectId: "p1",
      data: { name: "Next", icon: "Circle" },
    });

    await act(async () => finish({}));
    expect(next).toHaveValue("Next");
    expect(next).toHaveAttribute("readonly");
    fireEvent.keyDown(next, { key: "Enter" });
    expect(m.createColumn).toHaveBeenCalledTimes(2);
  });

  it("does not save while the icon picker has focus", async () => {
    render(<ColumnList projectId="p1" />);
    fireEvent.click(
      screen.getByRole("button", { name: "settings:columnEditor.addColumn" }),
    );
    const input = screen.getByRole("textbox", {
      name: "settings:columnEditor.newColumnPlaceholder",
    });
    fireEvent.change(input, { target: { value: "Review" } });
    const trigger = screen
      .getAllByRole("button", { name: "settings:columnEditor.pickIconTitle" })
      .at(-1) as HTMLElement;
    // Keeps focus on the input where the browser would not focus the button.
    expect(fireEvent.mouseDown(trigger)).toBe(false);
    fireEvent.blur(input, { relatedTarget: trigger });
    fireEvent.click(trigger);
    const search = await screen.findByRole("textbox", {
      name: "settings:columnEditor.searchIconsPlaceholder",
    });
    fireEvent.blur(input);
    fireEvent.blur(search);
    expect(m.createColumn).not.toHaveBeenCalled();
    expect(input).toHaveValue("Review");
  });

  it("is read-only without permission to update projects", () => {
    m.canUpdate = false;
    render(<ColumnList projectId="p1" />);
    expect(
      screen.queryByRole("button", { name: "settings:columnEditor.addColumn" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "settings:columnEditor.deleteAria",
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "settings:columnEditor.dragAria" }),
    ).toBeNull();
    for (const toggle of screen.getAllByRole("switch")) {
      expect(toggle).toHaveAttribute("aria-disabled", "true");
    }
  });
});
