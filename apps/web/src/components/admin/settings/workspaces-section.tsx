import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type {
  AdminSettings,
  AdminSettingsChange,
} from "@/fetchers/admin/settings-types";
import { SettingSwitchRow } from "./setting-switch-row";
import { useLockNote } from "./use-lock-note";

type WorkspacesSectionProps = {
  settings: AdminSettings;
  pending: boolean;
  onChange: (change: AdminSettingsChange) => void;
};

export function WorkspacesSection({
  settings,
  pending,
  onChange,
}: WorkspacesSectionProps) {
  const { t } = useTranslation();
  const lockNote = useLockNote(settings);

  return (
    <SettingsSection title={t("settings:adminSettings.workspaces")}>
      <SettingsCard>
        <SettingSwitchRow
          title={t("settings:adminSettings.workspaceCreationRestricted")}
          description={lockNote("workspaceCreationRestricted")}
          checked={settings.workspaceCreationRestricted}
          disabled={
            pending ||
            settings.lockedByEnv.includes("workspaceCreationRestricted")
          }
          onCheckedChange={(workspaceCreationRestricted) =>
            onChange({ workspaceCreationRestricted })
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
