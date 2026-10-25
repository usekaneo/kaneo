import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { SubtaskStatusDialog } from "./index";
import {
  clearSubtaskStatusPrompts,
  promptSubtaskStatus,
  useSubtaskStatusDialog,
} from "./store";

const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  update: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/fetchers/task/subtask-status", () => ({
  getSubtaskStatusPreview: mocks.preview,
  updateSubtaskStatuses: mocks.update,
}));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.error } }));
vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const preview = {
  parentTitle: "Parent",
  status: "done",
  statusName: "Done",
  subtasks: [
    {
      id: "child",
      title: "Child",
      projectId: "p",
      status: "to-do",
      assigneeName: "Alex",
      destinationStatus: "done",
    },
    {
      id: "grandchild",
      title: "Grandchild",
      projectId: "p",
      status: "in-progress",
      assigneeName: null,
      destinationStatus: "done",
    },
  ],
};
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SubtaskStatusDialog />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  clearSubtaskStatusPrompts();
  mocks.preview.mockResolvedValue(preview);
  mocks.update.mockResolvedValue({ success: true, updatedCount: 2 });
});
afterEach(cleanup);
it("lists descendants and skips without writing their statuses", async () => {
  mount();
  await act(() => promptSubtaskStatus("parent", "done"));
  expect(screen.getByText("Child")).toBeInTheDocument();
  expect(screen.getByText("Grandchild")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:subtaskStatus.skip" }),
  );
  expect(mocks.update).not.toHaveBeenCalled();
  expect(useSubtaskStatusDialog.getState().requests).toEqual([]);
});
it("updates exactly the displayed descendants on confirmation", async () => {
  mount();
  await act(() => promptSubtaskStatus("parent", "done"));
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:subtaskStatus.updateAll" }),
  );
  await waitFor(() =>
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith("parent", "done", [
      "child",
      "grandchild",
    ]),
  );
  await waitFor(() =>
    expect(useSubtaskStatusDialog.getState().requests).toEqual([]),
  );
});
it("keeps the dialog open with retryable feedback when updating fails", async () => {
  mocks.update.mockRejectedValue(new Error("offline"));
  mount();
  await act(() => promptSubtaskStatus("parent", "done"));
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:subtaskStatus.updateAll" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "tasks:subtaskStatus.updateError",
  );
  expect(useSubtaskStatusDialog.getState().requests).toHaveLength(1);
});
it("never opens a modal for ordinary statuses or parents without open descendants", async () => {
  mocks.preview.mockResolvedValue({ ...preview, subtasks: [] });
  mount();
  await act(() => promptSubtaskStatus("parent", "in-progress"));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("disables Update all when a child's project lacks a final column", async () => {
  mocks.preview.mockResolvedValue({
    ...preview,
    subtasks: [{ ...preview.subtasks[0], destinationStatus: null }],
  });
  mount();
  await act(() => promptSubtaskStatus("parent", "done"));
  expect(
    screen.getByRole("button", { name: "tasks:subtaskStatus.updateAll" }),
  ).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "tasks:subtaskStatus.noFinalColumn",
  );
});
it("discards a slow Done preview if the parent has since changed status", async () => {
  let resolve!: (value: typeof preview) => void;
  mocks.preview
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValueOnce({ ...preview, subtasks: [] });
  const old = promptSubtaskStatus("parent", "done");
  await promptSubtaskStatus("parent", "in-progress");
  resolve(preview);
  await old;
  expect(useSubtaskStatusDialog.getState().requests).toEqual([]);
});
it("does not surface an old user's pending preview after unmount", async () => {
  let resolve!: (value: typeof preview) => void;
  mocks.preview.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = mount();
  const pending = promptSubtaskStatus("parent", "done");
  view.unmount();
  resolve(preview);
  await pending;
  expect(useSubtaskStatusDialog.getState().requests).toEqual([]);
});
