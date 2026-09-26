import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useInviteWorkspaceUser from "@/hooks/mutations/workspace-user/use-invite-workspace-user";
import { toast } from "@/lib/toast";
import queryClient from "@/query-client";
import InviteTeamMemberModal from "./invite-team-member-modal";

const { inviteMember } = vi.hoisted(() => ({ inviteMember: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({
  authClient: { organization: { inviteMember } },
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string) =>
      key === "settings:invitationEmailFailed"
        ? "The invitation email could not be sent."
        : key,
  }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace" } }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canInviteUsers: () => true }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("./invitation-link-field", () => ({ default: () => null }));
function wrapper({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  inviteMember.mockResolvedValue({
    data: null,
    error: { code: "INVITATION_EMAIL_FAILED", message: "Upstream failure" },
  });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});
describe("invitation email delivery errors", () => {
  it.each([false, true])(
    "rejects with a translated error when resend is %s",
    async (resend) => {
      const { result } = renderHook(useInviteWorkspaceUser, { wrapper });
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      await act(async () => {
        await expect(
          result.current.mutateAsync({
            workspaceId: "workspace",
            email: "member@example.com",
            role: "member",
            resend,
          }),
        ).rejects.toThrow("The invitation email could not be sent.");
      });
      expect(inviteMember).toHaveBeenCalledWith({
        organizationId: "workspace",
        email: "member@example.com",
        role: "member",
        resend,
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["workspace-invites", "workspace"],
      });
    },
  );
  it("shows an error instead of a success notification in the invite modal", async () => {
    const onClose = vi.fn();
    render(<InviteTeamMemberModal open onClose={onClose} />, { wrapper });
    fireEvent.change(
      await screen.findByPlaceholderText("team:inviteModal.emailPlaceholder"),
      { target: { value: "member@example.com" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "team:inviteModal.sendInvitation" }),
    );
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "The invitation email could not be sent.",
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
