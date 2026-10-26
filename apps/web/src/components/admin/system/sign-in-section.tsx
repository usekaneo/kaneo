import { KeyRoundIcon, LogInIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { StatusBadge } from "@/components/settings/status-badge";
import type { AdminSystemStatus } from "@/fetchers/admin/system-types";
import { ServiceStatusBadge } from "./service-status-badge";
import { SystemStatusRow } from "./system-status-row";

type SignInSectionProps = {
  auth: AdminSystemStatus["auth"];
};

const SWITCHES = [
  {
    key: "passwordSignIn",
    label: "settings:adminSystem.signIn.passwordSignIn",
  },
  {
    key: "emailOtpSignIn",
    label: "settings:adminSystem.signIn.emailOtpSignIn",
  },
  { key: "registration", label: "settings:adminSystem.signIn.registration" },
  {
    key: "passwordRegistration",
    label: "settings:adminSystem.signIn.passwordRegistration",
  },
  { key: "guestAccess", label: "settings:adminSystem.signIn.guestAccess" },
  {
    key: "workspaceCreation",
    label: "settings:adminSystem.signIn.workspaceCreation",
  },
] as const;

const PROVIDER_DESCRIPTIONS = {
  github: "settings:adminSystem.signIn.providerDescriptions.github",
  google: "settings:adminSystem.signIn.providerDescriptions.google",
  discord: "settings:adminSystem.signIn.providerDescriptions.discord",
  custom: "settings:adminSystem.signIn.providerDescriptions.custom",
} as const;

export function SignInSection({ auth }: SignInSectionProps) {
  const { t } = useTranslation();

  return (
    <SettingsSection
      title={t("settings:adminSystem.signIn.title")}
      description={t("settings:adminSystem.signIn.description")}
    >
      <SettingsCard>
        {SWITCHES.map(({ key, label }) => (
          <SystemStatusRow
            key={key}
            icon={<LogInIcon />}
            title={t(label)}
            status={
              <StatusBadge tone={auth[key] ? "success" : "neutral"}>
                {auth[key]
                  ? t("settings:adminSystem.signIn.on")
                  : t("settings:adminSystem.signIn.off")}
              </StatusBadge>
            }
          />
        ))}
        {auth.providers.map((provider) => (
          <SystemStatusRow
            key={provider.id}
            icon={<KeyRoundIcon />}
            title={provider.name}
            description={t(PROVIDER_DESCRIPTIONS[provider.id])}
            status={
              <ServiceStatusBadge status={provider.status} variant="setup" />
            }
          />
        ))}
      </SettingsCard>
    </SettingsSection>
  );
}
