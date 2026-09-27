import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

export function useOpenWorkspaceBilling(workspaceId: string | undefined) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpening, setIsOpening] = useState(false);

  const open = async () => {
    if (!workspaceId || isOpening) return;

    setIsOpening(true);
    try {
      const { error } = await authClient.organization.setActive({
        organizationId: workspaceId,
      });
      if (error) {
        toast.error(t("settings:billing.openFailed"));
        return;
      }
      await navigate({ to: "/dashboard/settings/workspace/billing" });
    } catch {
      toast.error(t("settings:billing.openFailed"));
    } finally {
      setIsOpening(false);
    }
  };

  return { open, isOpening };
}
