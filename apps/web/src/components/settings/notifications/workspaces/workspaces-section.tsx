import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { getChannelAvailability } from "../get-channel-availability";
import { WorkspaceRuleRow } from "./workspace-rule-row";

type WorkspacesSectionProps = {
  preferences: NotificationPreferences;
};

export function WorkspacesSection({ preferences }: WorkspacesSectionProps) {
  const { t } = useTranslation();
  const { data: workspaces } = useGetWorkspaces();
  const availability = getChannelAvailability(preferences);
  const rules = new Map(
    preferences.workspaces.map((rule) => [rule.workspaceId, rule]),
  );

  if (!workspaces?.length) return null;

  return (
    <SettingsSection
      title={t("settings:notificationsPage.workspacesTitle")}
      description={t("settings:notificationsPage.workspacesDescription")}
    >
      <SettingsCard>
        {workspaces.map((workspace) => (
          <WorkspaceRuleRow
            key={workspace.id}
            availability={availability}
            rule={rules.get(workspace.id)}
            workspace={{ id: workspace.id, name: workspace.name }}
          />
        ))}
      </SettingsCard>
    </SettingsSection>
  );
}
