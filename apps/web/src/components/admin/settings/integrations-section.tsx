import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type {
  AdminSettings,
  AdminSettingsChange,
} from "@/fetchers/admin/settings-types";
import { SettingSwitchRow } from "./setting-switch-row";

type IntegrationsSectionProps = {
  settings: AdminSettings;
  pending: boolean;
  onChange: (change: AdminSettingsChange) => void;
};

export function IntegrationsSection({
  settings,
  pending,
  onChange,
}: IntegrationsSectionProps) {
  const { t } = useTranslation();
  const disabled = new Set(settings.disabledIntegrations);

  return (
    <SettingsSection title={t("settings:adminSettings.integrations")}>
      <SettingsCard>
        {settings.integrationProviders.map((provider) => (
          <SettingSwitchRow
            key={provider.type}
            title={provider.name}
            checked={!disabled.has(provider.type)}
            disabled={pending}
            onCheckedChange={(enabled) => {
              const next = new Set(disabled);
              if (enabled) next.delete(provider.type);
              else next.add(provider.type);
              onChange({ disabledIntegrations: [...next] });
            }}
          />
        ))}
      </SettingsCard>
    </SettingsSection>
  );
}
