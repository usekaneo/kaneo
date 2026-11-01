import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { WorkspaceBreadcrumb } from "@/components/common/workspace-layout";

// Agent › Automations, the parents of every page below the list.
export function useAutomationsBreadcrumbs(
  workspaceId: string,
): WorkspaceBreadcrumb[] {
  const { t } = useTranslation();
  return [
    {
      label: t("agent:title"),
      link: (
        <Link
          to="/dashboard/workspace/$workspaceId/agent"
          params={{ workspaceId }}
        />
      ),
    },
    {
      label: t("agent:automations.title"),
      link: (
        <Link
          to="/dashboard/workspace/$workspaceId/agent/automations"
          params={{ workspaceId }}
        />
      ),
    },
  ];
}
