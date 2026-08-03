import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItemTypesSettingsPage } from "./item-types";

const mocks = vi.hoisted(() => ({
  archiveItemType: vi.fn(),
  canManageItemTypes: true,
  createItemType: vi.fn(),
  itemTypesQuery: {
    data: [
      {
        id: "type-active",
        workspaceId: "workspace-1",
        key: "task",
        name: "Task",
        icon: "circle-check",
        description: "Work that needs to be completed",
        position: 0,
        archivedAt: null,
      },
    ],
    error: null as Error | null,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  },
  toastError: vi.fn(),
  updateItemType: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => () => ({}),
}));

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("@/components/page-title", () => ({ default: () => null }));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    workspace: { id: "workspace-1", name: "Acme" },
    canManageItemTypes: () => mocks.canManageItemTypes,
  }),
}));

vi.mock("@/hooks/queries/item-type/use-get-item-types", () => ({
  default: () => mocks.itemTypesQuery,
}));

vi.mock("@/hooks/mutations/item-type/use-create-item-type", () => ({
  default: () => ({ mutateAsync: mocks.createItemType, isPending: false }),
}));

vi.mock("@/hooks/mutations/item-type/use-update-item-type", () => ({
  default: () => ({ mutateAsync: mocks.updateItemType, isPending: false }),
}));

vi.mock("@/hooks/mutations/item-type/use-archive-item-type", () => ({
  default: () => ({ mutateAsync: mocks.archiveItemType, isPending: false }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: mocks.toastError },
}));

describe("ItemTypesSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archiveItemType.mockResolvedValue(undefined);
    mocks.createItemType.mockResolvedValue(undefined);
    mocks.canManageItemTypes = true;
    mocks.itemTypesQuery.data = [
      {
        id: "type-active",
        workspaceId: "workspace-1",
        key: "task",
        name: "Task",
        icon: "circle-check",
        description: "Work that needs to be completed",
        position: 0,
        archivedAt: null,
      },
    ];
    mocks.itemTypesQuery.error = null;
    mocks.itemTypesQuery.isError = false;
    mocks.itemTypesQuery.isFetching = false;
    mocks.itemTypesQuery.isLoading = false;
    mocks.itemTypesQuery.refetch.mockResolvedValue({ error: null });
    mocks.updateItemType.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it("shows active item types with separate icon and description while keeping the create form hidden", () => {
    render(<ItemTypesSettingsPage />);

    expect(screen.getByText("Task")).toBeTruthy();
    expect(
      screen.getByTitle("circle-check").querySelector(".lucide-circle-check"),
    ).toBeTruthy();
    expect(screen.getByText("Work that needs to be completed")).toBeTruthy();
    expect(screen.queryByText("Archived item types")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Create item type" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("opens the create dialog, validates fields, trims values, and reports errors", async () => {
    render(<ItemTypesSettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Create item type" }));
    expect(screen.getByLabelText("Name")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "  Bug  " },
    });
    fireEvent.change(screen.getByLabelText("Key"), {
      target: { value: "Bad key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    const keyError = screen.getByText(
      "Use 2-32 lowercase letters, numbers, or hyphens, starting with a letter.",
    );
    expect(keyError).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("Key")).toHaveAttribute(
      "aria-describedby",
      keyError.id,
    );
    expect(mocks.createItemType).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Key"), {
      target: { value: "  bug-report  " },
    });
    fireEvent.change(screen.getByLabelText("Icon"), {
      target: { value: "  bug  " },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "  Needs attention  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(mocks.createItemType).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        key: "bug-report",
        name: "Bug",
        icon: "bug",
        description: "Needs attention",
        position: 1,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create item type" }));
    mocks.createItemType.mockRejectedValueOnce(new Error("Duplicate key"));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Bug" },
    });
    fireEvent.change(screen.getByLabelText("Key"), {
      target: { value: "bug" },
    });
    fireEvent.change(screen.getByLabelText("Icon"), {
      target: { value: "bug" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Duplicate key"),
    );
  });

  it("preserves loading and query error feedback with retry", async () => {
    mocks.itemTypesQuery.isLoading = true;
    const { rerender } = render(<ItemTypesSettingsPage />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading item types...",
    );
    expect(screen.queryByText("No item types yet.")).toBeNull();

    mocks.itemTypesQuery.isLoading = false;
    mocks.itemTypesQuery.isError = true;
    mocks.itemTypesQuery.error = new Error("Network unavailable");
    mocks.itemTypesQuery.refetch.mockResolvedValueOnce({
      error: new Error("Still offline"),
    });
    rerender(<ItemTypesSettingsPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Network unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(mocks.itemTypesQuery.refetch).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Still offline"),
    );
  });

  it("uses item type permissions for management actions", () => {
    mocks.canManageItemTypes = false;
    render(<ItemTypesSettingsPage />);

    expect(
      screen.queryByRole("button", { name: "Create item type" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Task" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive Task" })).toBeNull();
  });

  it("edits an active item type and preserves its position", async () => {
    render(<ItemTypesSettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Task");
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "  Work item  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mocks.updateItemType).toHaveBeenCalledWith({
        id: "type-active",
        key: "task",
        name: "Work item",
        icon: "circle-check",
        description: "Work that needs to be completed",
        position: 0,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit Task" }));
    mocks.updateItemType.mockRejectedValueOnce(new Error("Update failed"));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Update failed"),
    );
  });

  it("explains and confirms archival without deleting historical tasks", async () => {
    render(<ItemTypesSettingsPage />);

    fireEvent.click(screen.getByRole("button", { name: "Archive Task" }));
    expect(screen.getByText("Archive Task?")).toBeTruthy();
    expect(
      screen.getByText(
        "Existing tasks keep this type; it will no longer be available for new assignments.",
      ),
    ).toBeTruthy();

    mocks.archiveItemType.mockRejectedValueOnce(new Error("Archive failed"));
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(mocks.archiveItemType).toHaveBeenCalledWith({ id: "type-active" }),
    );
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Archive failed"),
    );
  });
});
