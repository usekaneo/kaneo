import { KeyRoundIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getApiKeyExpiry } from "@/components/settings/api-keys/get-api-key-expiry";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { Button } from "@/components/ui/button";
import type { AdminApiKey } from "@/fetchers/admin/get-admin-user-api-keys";
import { formatDateMedium, formatRelativeTime } from "@/lib/format";

type Props = {
  apiKey: AdminApiKey;
  onRevoke: () => void;
};

export function AdminApiKeyRow({ apiKey, onRevoke }: Props) {
  const { t } = useTranslation();
  const name = apiKey.name || t("settings:developerPage.unnamedKey");
  const expiry = getApiKeyExpiry(apiKey.expiresAt);
  const inactive = expiry.status === "expired" || !apiKey.enabled;
  const details = [
    t("settings:apiKey.row.created", {
      date: formatDateMedium(apiKey.createdAt),
    }),
    apiKey.lastUsedAt
      ? t("settings:adminUsers.security.lastUsed", {
          time: formatRelativeTime(apiKey.lastUsedAt),
        })
      : t("settings:adminUsers.security.neverUsed"),
    expiry.status === "never"
      ? t("settings:apiKey.row.neverExpires")
      : t(
          expiry.status === "expired"
            ? "settings:apiKey.row.expired"
            : "settings:apiKey.row.expires",
          { date: formatDateMedium(expiry.date) },
        ),
  ];

  return (
    <SettingsRow
      icon={<KeyRoundIcon className={inactive ? "opacity-50" : undefined} />}
      title={name}
      titleClassName={inactive ? "text-muted-foreground" : undefined}
      badge={
        !apiKey.enabled ? (
          <StatusBadge tone="neutral">
            {t("settings:adminUsers.security.disabled")}
          </StatusBadge>
        ) : expiry.status === "expired" ? (
          <StatusBadge tone="destructive">
            {t("settings:apiKey.row.expiredBadge")}
          </StatusBadge>
        ) : null
      }
      description={
        <span className="flex min-w-0 items-center gap-2">
          {apiKey.start ? (
            <span className="shrink-0 font-mono">{apiKey.start}…</span>
          ) : null}
          <span className="truncate">{details.join(" / ")}</span>
        </span>
      }
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("settings:adminUsers.security.revokeKeyLabel", { name })}
        onClick={onRevoke}
      >
        {t("settings:adminUsers.security.revokeKey")}
      </Button>
    </SettingsRow>
  );
}
