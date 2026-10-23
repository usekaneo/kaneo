import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { PreferenceSwitchRow } from "@/components/settings/preferences/preference-switch-row";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

// Stored on the account, so it follows the user to every device and client.
export function AutoAssignRow() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [pending, setPending] = useState<boolean | null>(null);
  const checked = pending ?? Boolean(user?.autoAssignSelf);

  const onCheckedChange = async (next: boolean) => {
    setPending(next);
    const { error } = await authClient.updateUser({ autoAssignSelf: next });
    if (error) toast.error(t("settings:preferencesPage.autoAssignError"));
    setPending(null);
  };

  return (
    <PreferenceSwitchRow
      title={t("settings:preferencesPage.autoAssign")}
      description={t("settings:preferencesPage.autoAssignDescription")}
      checked={checked}
      onCheckedChange={onCheckedChange}
    />
  );
}
