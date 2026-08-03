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
  createItemType: vi.fn(),
  itemTypes: [
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
    {
      id: "type-archived",
      workspaceId: "workspace-1",
      key: "incident",
      name: "Incident",
      icon: "triangle-alert",
      description: null,
      position: 1,
      archivedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
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
    isAdmin: true,
  }),
}));

vi.mock("@/hooks/queries/item-type/use-get-item-types", () => ({
  default: () => ({ data: mocks.itemTypes, isLoading: false }),
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
    mocks.updateItemType.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it("shows active and archived item types while keeping the create form hidden", () => {
    render(<ItemTypesSettingsPage />);

    expect(screen.getByText("Active item types")).toBeTruthy();
    expect(screen.getByText("Archived item types")).toBeTruthy();
    expect(screen.getByText("Task")).toBeTruthy();
    expect(screen.getByText("Incident")).toBeTruthy();
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
    expect(
      screen.getByText(
        "Use 2-32 lowercase letters, numbers, or hyphens, starting with a letter.",
      ),
    ).toBeTruthy();
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
        position: 2,
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
        "Historical tasks keep this item type, but it cannot be assigned to new tasks.",
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
