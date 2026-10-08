import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import SubtaskLinkPicker from "./subtask-link-picker";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  close: vi.fn(),
  search: vi.fn(),
  relations: vi.fn(),
  error: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-debounced-value", () => ({
  useDebouncedValue: (value: string) => value,
}));
vi.mock("@/hooks/queries/search/use-global-search", () => ({
  default: (params: unknown) => mocks.search(params),
}));
vi.mock("@/hooks/queries/task-relation/use-get-task-relations", () => ({
  default: () => mocks.relations(),
}));
vi.mock("@/hooks/mutations/task-relation/use-create-task-relation", () => ({
  default: () => ({ mutateAsync: mocks.create, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: mocks.error },
}));

beforeEach(() => {
  mocks.create.mockResolvedValue({});
  mocks.relations.mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
  });
  mocks.search.mockReturnValue({
    data: {
      results: [
        {
          type: "task",
          id: "candidate",
          title: "Existing task",
          projectSlug: "TEST",
          taskNumber: 2,
        },
        { type: "task", id: "current", title: "Current task" },
      ],
    },
    isFetching: false,
    isError: false,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPicker(direction: "parent" | "child") {
  render(
    <SubtaskLinkPicker
      taskId="current"
      workspaceId="workspace"
      direction={direction}
      onClose={mocks.close}
    />,
  );
}

describe("SubtaskLinkPicker", () => {
  it.each(["parent", "child"] as const)(
    "links an existing %s with the correct direction",
    async (direction) => {
      renderPicker(direction);
      expect(screen.queryByText("Current task")).not.toBeInTheDocument();
      fireEvent.click(await screen.findByText("Existing task"));
      await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
      expect(mocks.create).toHaveBeenCalledWith({
        sourceTaskId: direction === "parent" ? "candidate" : "current",
        targetTaskId: direction === "parent" ? "current" : "candidate",
        relationType: "subtask",
      });
      expect(mocks.search).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "workspace",
          type: "tasks",
        }),
      );
    },
  );

  it("excludes existing parents and children", () => {
    mocks.relations.mockReturnValue({
      data: [
        {
          relationType: "subtask",
          sourceTaskId: "candidate",
          targetTaskId: "current",
        },
      ],
      isPending: false,
    });
    renderPicker("child");
    expect(screen.queryByText("Existing task")).not.toBeInTheDocument();
  });

  it("keeps the picker open and reports a rejected link", async () => {
    mocks.create.mockRejectedValue(new Error("Circular hierarchy"));
    renderPicker("parent");
    fireEvent.click(await screen.findByText("Existing task"));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Circular hierarchy"),
    );
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it("shows search failures rather than an empty success state", () => {
    mocks.search.mockReturnValue({ isError: true, isFetching: false });
    renderPicker("parent");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "tasks:subtasks.searchError",
    );
  });

  it("shows loading and does not offer stale results while searching", () => {
    mocks.search.mockReturnValue({
      isFetching: true,
      data: { results: [{ id: "stale", type: "task", title: "Stale result" }] },
    });
    renderPicker("child");
    expect(screen.getByRole("status")).toHaveTextContent(
      "tasks:subtasks.loading",
    );
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
  });

  it("supports dismissing with Escape", async () => {
    renderPicker("parent");
    fireEvent.keyDown(
      await screen.findByPlaceholderText("tasks:subtasks.searchPlaceholder"),
      { key: "Escape" },
    );
    await waitFor(() => expect(mocks.close).toHaveBeenCalledOnce());
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("supports selecting the highlighted task with Enter", async () => {
    renderPicker("child");
    const input = await screen.findByPlaceholderText(
      "tasks:subtasks.searchPlaceholder",
    );
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        sourceTaskId: "current",
        targetTaskId: "candidate",
        relationType: "subtask",
      }),
    );
  });
});
