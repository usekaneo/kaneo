import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type {
  AdminSettings,
  AdminSettingsChange,
} from "@/fetchers/admin/settings-types";
import useAdminAccess from "@/hooks/queries/admin/use-admin-access";
import { DefaultRoleRow } from "./default-role-row";
import { SettingSwitchRow } from "./setting-switch-row";
import { useLockNote } from "./use-lock-note";

type RegistrationSectionProps = {
  settings: AdminSettings;
  pending: boolean;
  onChange: (change: AdminSettingsChange) => void;
};

export function RegistrationSection({
  settings,
  pending,
  onChange,
}: RegistrationSectionProps) {
  const { t } = useTranslation();
  const { permissions } = useAdminAccess();
  const lockNote = useLockNote(settings);
  const locked = (setting: AdminSettings["lockedByEnv"][number]) =>
    settings.lockedByEnv.includes(setting);
  const verificationUnavailable =
    !settings.emailDeliveryConfigured && !settings.requireEmailVerification;

  return (
    <SettingsSection
      title={t("settings:adminSettings.registration")}
      action={
        permissions.includes("system:read") ? (
          <Link
            to="/dashboard/settings/admin/system"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("settings:adminSettings.signInProviders")}
          </Link>
        ) : undefined
      }
    >
      <SettingsCard>
        <SettingSwitchRow
          title={t("settings:adminSettings.registrationEnabled")}
          description={lockNote("registrationEnabled")}
          checked={settings.registrationEnabled}
          disabled={pending || locked("registrationEnabled")}
          onCheckedChange={(registrationEnabled) =>
            onChange({ registrationEnabled })
          }
        />
        <SettingSwitchRow
          title={t("settings:adminSettings.passwordRegistrationEnabled")}
          description={lockNote("passwordRegistrationEnabled")}
          checked={settings.passwordRegistrationEnabled}
          disabled={pending || locked("passwordRegistrationEnabled")}
          onCheckedChange={(passwordRegistrationEnabled) =>
            onChange({ passwordRegistrationEnabled })
          }
        />
        <SettingSwitchRow
          title={t("settings:adminSettings.requireEmailVerification")}
          description={
            verificationUnavailable
              ? t("settings:adminSettings.requiresSmtp")
              : undefined
          }
          checked={settings.requireEmailVerification}
          disabled={pending || verificationUnavailable}
          onCheckedChange={(requireEmailVerification) =>
            onChange({ requireEmailVerification })
          }
        />
        <DefaultRoleRow
          value={settings.defaultRole}
          roles={settings.roles}
          disabled={pending}
          onValueChange={(defaultRole) => onChange({ defaultRole })}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
