import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

/** Accept (and switch to) or decline a workspace invitation. */
export function useInvitationActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["invitations", "pending"] });

  const accept = async (invitationId: string, workspaceId: string) => {
    setBusyId(invitationId);
    try {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (error) {
        toast.error(error.message || t("invitations:toast.acceptError"));
        return;
      }
      const joined = data?.invitation.organizationId || workspaceId;
      await authClient.organization.setActive({ organizationId: joined });
      toast.success(t("invitations:toast.acceptSuccess"));
      await refresh();
      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: joined },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("invitations:toast.acceptError"),
      );
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (invitationId: string) => {
    setBusyId(invitationId);
    try {
      const { error } = await authClient.organization.rejectInvitation({
        invitationId,
      });
      if (error) {
        toast.error(error.message || t("invitations:toast.rejectError"));
        return;
      }
      toast.success(t("invitations:toast.rejectSuccess"));
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("invitations:toast.rejectError"),
      );
    } finally {
      setBusyId(null);
    }
  };

  return { accept, decline, busyId };
}
