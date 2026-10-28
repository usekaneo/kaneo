import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import type {
  AdminSettings,
  AdminSettingsChange,
} from "@/fetchers/admin/settings-types";
import { InstanceNameRow } from "./instance-name-row";

type GeneralSectionProps = {
  settings: AdminSettings;
  pending: boolean;
  onChange: (change: AdminSettingsChange) => void;
};

export function GeneralSection({
  settings,
  pending,
  onChange,
}: GeneralSectionProps) {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t("settings:adminSettings.general")}>
      <SettingsCard>
        <InstanceNameRow
          value={settings.instanceName}
          pending={pending}
          onSave={(instanceName) => onChange({ instanceName })}
        />
        <SettingsRow
          stack
          title={t("settings:adminSettings.instanceUrl")}
          description={
            settings.instanceUrl
              ? undefined
              : t("settings:adminSettings.instanceUrlMissing")
          }
        >
          {settings.instanceUrl ? (
            <code className="truncate text-xs text-muted-foreground">
              {settings.instanceUrl}
            </code>
          ) : null}
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
