import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "./labels";

vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));

const m = vi.hoisted(() => ({
  remove: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  pending: false,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    workspace: { id: "workspace" },
    canCreateLabels: () => true,
    canUpdateLabels: () => true,
    canDeleteLabels: () => true,
  }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({
    data: [
      {
        id: "root",
        name: "bug",
        color: "red",
        taskId: null,
        deletionStartedAt: "2026-09-19T12:00:00Z",
      },
    ],
  }),
}));
vi.mock("@/hooks/mutations/label/use-create-label", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/mutations/label/use-update-label", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/mutations/label/use-delete-label", () => ({
  default: () => ({ mutateAsync: m.remove, isPending: m.pending }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { success: m.success, error: m.error },
}));
const Component = Route.options.component as ComponentType;
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  m.pending = false;
});
describe("resuming workspace label deletion", () => {
  it("shows persisted deletion state, prevents editing and resumes after confirmation", async () => {
    m.remove.mockResolvedValue({ id: "root" });
    render(<Component />);
    expect(
      screen.getByText("settings:workspaceLabels.deletionPending"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Label" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceLabels.resumeDeletion",
      }),
    );
    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "settings:workspaceLabels.resumeDeletion",
      }),
    );
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith({ id: "root" }));
    await waitFor(() =>
      expect(m.success).toHaveBeenCalledWith("Label deleted"),
    );
  });
  it("keeps the confirmation available and never reports success on another connection failure", async () => {
    m.remove.mockRejectedValue(new Error("Connection lost"));
    render(<Component />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceLabels.resumeDeletion",
      }),
    );
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
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
