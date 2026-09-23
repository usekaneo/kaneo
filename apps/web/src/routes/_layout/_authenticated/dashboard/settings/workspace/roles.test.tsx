import { defaultRolePayloads } from "@kaneo/permissions";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomRoleEditor, PermissionList } from "./roles";

const m = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));
vi.mock("@/hooks/mutations/workspace/use-update-workspace-role", () => ({
  default: () => ({ mutateAsync: m.update, isPending: false }),
}));
vi.mock("@/hooks/mutations/workspace/use-create-workspace-role", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/mutations/workspace/use-delete-workspace-role", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/queries/workspace/use-workspace-roles", () => ({
  default: () => ({}),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({}),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  m.update.mockResolvedValue({ success: true });
});

describe("workspace role permission editing", () => {
  it("shows role administration, membership and invitations in read-only role details", () => {
    render(<PermissionList permissions={defaultRolePayloads.admin} readOnly />);
    for (const label of [
      "Change role permissions",
      "Change member roles",
      "Invite members",
      "Edit teams",
    ]) {
      expect(screen.getByRole("switch", { name: label })).toBeChecked();
      expect(screen.getByRole("switch", { name: label })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
  });
  it("can remove every permission, including all provider administrative rights", async () => {
    render(
      <CustomRoleEditor
        workspaceId="workspace"
        role={{
          id: "role",
          workspaceId: "workspace",
          role: "admin",
          permission: defaultRolePayloads.admin,
          createdAt: new Date(),
        }}
        isDefault
        onDelete={() => {}}
      />,
    );
    for (const control of screen.getAllByRole("switch", { checked: true }))
      fireEvent.click(control);
    fireEvent.click(
      screen.getByRole("button", {
        name: "settings:workspaceRoles.saveChanges",
      }),
    );
    await waitFor(() =>
      expect(m.update).toHaveBeenCalledWith({
        workspaceId: "workspace",
        roleName: "admin",
        permission: {},
      }),
    );
  });
  it("also exposes unknown stored permission entries instead of silently retaining them", () => {
    render(
      <PermissionList
        permissions={{ extension: ["future-right"] }}
        selected={{ extension: new Set(["future-right"]) }}
        onToggle={() => {}}
      />,
    );
    expect(
      screen.getByRole("switch", { name: "future-right extension" }),
    ).toBeChecked();
  });
});
