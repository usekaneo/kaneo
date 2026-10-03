import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildSettingsNav } from "@/components/settings/nav/build-settings-nav";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import useGetConfig from "@/hooks/queries/config/use-get-config";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

export function useSettingsNav() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: projects } = useGetProjects({
    workspaceId: workspace?.id ?? "",
  });
  const { data: config } = useGetConfig();
  const { data: hasAdminAccess } = useAdminAccess();

  return useMemo(
    () =>
      buildSettingsNav({
        t,
        workspaceName: workspace?.name,
        billingEnabled: Boolean(config?.billingEnabled),
        hasAdminAccess: Boolean(hasAdminAccess),
        projects: projects ?? [],
      }),
    [t, workspace?.name, config?.billingEnabled, hasAdminAccess, projects],
  );
}
