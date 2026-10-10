import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import type getColumns from "@/fetchers/column/get-columns";
import ColumnEditor from "./column-editor";

type Columns = Awaited<ReturnType<typeof getColumns>>;
const mocks = vi.hoisted(() => ({
  reorder: vi.fn(),
  create: vi.fn(),
  error: vi.fn(),
  columns: [] as Columns,
  creating: false,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: () => ({ data: mocks.columns, isLoading: false }),
}));
vi.mock("@/hooks/mutations/column/use-reorder-columns", () => ({
  useReorderColumns: () => ({ mutateAsync: mocks.reorder, isPending: false }),
}));
vi.mock("@/hooks/mutations/column/use-create-column", () => ({
  useCreateColumn: () => ({
    mutateAsync: mocks.create,
    isPending: mocks.creating,
  }),
}));
vi.mock("@/hooks/mutations/column/use-update-column", () => ({
  useUpdateColumn: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/mutations/column/use-delete-column", () => ({
  useDeleteColumn: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canManageProjects: () => true }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: mocks.error },
}));

const column = (id: string, position: number): Columns[number] => ({
  id,
  projectId: "project",
  name: id,
  slug: id,
  position,
  icon: null,
  color: null,
  isFinal: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});
function names() {
  return screen
    .getAllByRole("listitem")
    .map((row) => row.querySelector("input")?.value);
}
function row(name: string) {
  return screen
    .getAllByRole("listitem")
    .find((item) => item.querySelector("input")?.value === name)!;
}
function start(name: string) {
  fireEvent.dragStart(row(name), {
    dataTransfer: { setData: vi.fn(), setDragImage: vi.fn() },
    clientX: 0,
    clientY: 0,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.creating = false;
  mocks.columns = ["A", "B", "C", "D"].map(column);
});
afterEach(cleanup);

describe("ColumnEditor reorder", () => {
  it("keeps moving the same ID through rapid hover events, saves once on drop, and blocks overlapping drags", async () => {
    let resolve!: () => void;
    mocks.reorder.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const view = render(<ColumnEditor projectId="project" />);
    start("D");
    fireEvent.dragOver(row("B"));
    fireEvent.dragOver(row("B"));
    expect(names()).toEqual(["A", "D", "B", "C"]);
    fireEvent.dragOver(row("A"));
    expect(names()).toEqual(["D", "A", "B", "C"]);
    expect(mocks.reorder).not.toHaveBeenCalled();

    // A refetch arriving mid-drag must not replace the local draft.
    mocks.columns = [...mocks.columns];
    view.rerender(<ColumnEditor projectId="project" />);
    expect(names()).toEqual(["D", "A", "B", "C"]);
    fireEvent.drop(row("D"));
    fireEvent.dragEnd(row("D"));
    expect(mocks.reorder).toHaveBeenCalledTimes(1);
    expect(mocks.reorder).toHaveBeenCalledWith({
      projectId: "project",
      columns: ["D", "A", "B", "C"].map((id, position) => ({ id, position })),
    });
    start("B");
    fireEvent.dragOver(row("D"));
    fireEvent.drop(row("D"));
    expect(mocks.reorder).toHaveBeenCalledTimes(1);
    expect(names()).toEqual(["D", "A", "B", "C"]);
    await act(async () => {
      mocks.columns = ["D", "A", "B", "C"].map(column);
      resolve();
    });
    expect(row("D").getAttribute("draggable")).toBe("true");

    start("D");
    fireEvent.dragOver(row("C"));
    expect(names()).toEqual(["A", "B", "C", "D"]);
    fireEvent.dragEnd(row("D"));
    expect(names()).toEqual(["D", "A", "B", "C"]);
    expect(mocks.reorder).toHaveBeenCalledTimes(1);
  });

  it("does not save canceled or unchanged drags", () => {
    render(<ColumnEditor projectId="project" />);
    start("D");
    fireEvent.dragOver(row("A"));
    fireEvent.dragEnd(row("D"));
    expect(names()).toEqual(["A", "B", "C", "D"]);
    start("D");
    fireEvent.drop(row("D"));
    expect(mocks.reorder).not.toHaveBeenCalled();
  });

  it("reports save failures, restores the query order, and allows retry", async () => {
    mocks.reorder.mockRejectedValue(new Error("Cannot save order"));
    render(<ColumnEditor projectId="project" />);
    start("D");
    fireEvent.dragOver(row("A"));
    await act(async () => {
      fireEvent.drop(row("D"));
    });
    expect(mocks.error).toHaveBeenCalledWith("Cannot save order");
    expect(names()).toEqual(["A", "B", "C", "D"]);
    expect(row("D").getAttribute("draggable")).toBe("true");
  });

  it("cannot drag while creation is pending and can drag the new column after refresh", () => {
    mocks.creating = true;
    const view = render(<ColumnEditor projectId="project" />);
    start("D");
    fireEvent.dragOver(row("A"));
    expect(names()).toEqual(["A", "B", "C", "D"]);
    mocks.creating = false;
    mocks.columns = [...mocks.columns, column("E", 4)];
    view.rerender(<ColumnEditor projectId="project" />);
    start("E");
    fireEvent.dragOver(row("A"));
    fireEvent.dragOver(row("B"));
    expect(names()).toEqual(["A", "B", "E", "C", "D"]);
    expect(mocks.reorder).not.toHaveBeenCalled();
  });
});
