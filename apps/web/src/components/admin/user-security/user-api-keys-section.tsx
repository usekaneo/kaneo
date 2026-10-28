import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import type { AdminApiKey } from "@/fetchers/admin/get-admin-user-api-keys";
import type { AdminUser } from "@/fetchers/admin/types";
import useRevokeAdminUserApiKey from "@/hooks/mutations/admin/use-revoke-admin-user-api-key";
import useAdminUserApiKeys from "@/hooks/queries/admin/use-admin-user-api-keys";
import { toast } from "@/lib/toast";
import { AdminApiKeyRow } from "./admin-api-key-row";

export function UserApiKeysSection({ user }: { user: AdminUser }) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useAdminUserApiKeys(user.id);
  const revokeKey = useRevokeAdminUserApiKey();
  const [revoking, setRevoking] = useState<AdminApiKey | null>(null);
  const apiKeys = data?.apiKeys ?? [];
  const revokingName = revoking?.name || t("settings:developerPage.unnamedKey");

  const handleRevoke = async () => {
    if (!revoking) return;
    try {
      await revokeKey.mutateAsync({ userId: user.id, apiKeyId: revoking.id });
      toast.success(t("settings:adminUsers.security.toastKeyRevoked"), {
        icon: Trash2Icon,
      });
      setRevoking(null);
    } catch {
      toast.error(t("settings:adminUsers.security.toastKeyRevokeError"));
    }
  };

  const renderKeys = () => {
    if (isPending) return <SettingsRowsSkeleton rows={1} withDescription />;
    if (isError) {
      return (
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <p role="alert" className="text-destructive-foreground text-sm">
            {t("settings:adminUsers.security.apiKeysLoadError")}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
          >
            {t("settings:adminUsers.retry")}
          </Button>
        </div>
      );
    }
    if (apiKeys.length === 0) {
      return (
        <p className="px-4 py-3.5 text-muted-foreground text-sm">
          {t("settings:adminUsers.security.apiKeysEmpty")}
        </p>
      );
    }
    return apiKeys.map((apiKey) => (
      <AdminApiKeyRow
        key={apiKey.id}
        apiKey={apiKey}
        onRevoke={() => setRevoking(apiKey)}
      />
    ));
  };

  return (
    <SettingsSection title={t("settings:adminUsers.security.apiKeysTitle")}>
      <SettingsCard>{renderKeys()}</SettingsCard>
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open && !revokeKey.isPending) setRevoking(null);
        }}
        title={t("settings:adminUsers.security.revokeKeyConfirmTitle", {
          name: revokingName,
        })}
        description={t(
          "settings:adminUsers.security.revokeKeyConfirmDescription",
        )}
        confirmLabel={t("settings:adminUsers.security.revokeKey")}
        pendingLabel={t("settings:adminUsers.security.revokingKey")}
        pending={revokeKey.isPending}
        onConfirm={handleRevoke}
      />
    </SettingsSection>
  );
}
