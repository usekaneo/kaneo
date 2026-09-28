import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

export function useOpenWorkspaceBilling(workspaceId: string | undefined) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const [isSwitching, setIsSwitching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingId || activeOrganization?.id !== pendingId) return;
    setPendingId(null);
    navigate({ to: "/dashboard/settings/workspace/billing" });
  }, [pendingId, activeOrganization?.id, navigate]);

  const open = async () => {
    if (!workspaceId || isSwitching || pendingId) return;

    setIsSwitching(true);
    try {
      const { error } = await authClient.organization.setActive({
        organizationId: workspaceId,
      });
      if (error) {
        toast.error(t("settings:billing.openFailed"));
        return;
      }
      setPendingId(workspaceId);
    } catch {
      toast.error(t("settings:billing.openFailed"));
    } finally {
      setIsSwitching(false);
    }
  };

  return { open, isOpening: isSwitching || pendingId !== null };
}
