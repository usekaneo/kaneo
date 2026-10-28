import { KeyRoundIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ApiKeyItem } from "@/components/settings/api-keys/api-key-item";
import { getApiKeyExpiry } from "@/components/settings/api-keys/get-api-key-expiry";
import { RowActionsMenu } from "@/components/settings/row-actions-menu";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { formatDateMedium } from "@/lib/format";

type ApiKeyRowProps = {
  apiKey: ApiKeyItem;
  onDelete: (apiKey: ApiKeyItem) => void;
};

export function ApiKeyRow({ apiKey, onDelete }: ApiKeyRowProps) {
  const { t } = useTranslation();
  const name = apiKey.name || t("settings:developerPage.unnamedKey");
  const expiry = getApiKeyExpiry(apiKey.expiresAt);
  const expired = expiry.status === "expired";
  const created = t("settings:apiKey.row.created", {
    date: formatDateMedium(apiKey.createdAt),
  });
  const expiryText =
    expiry.status === "never"
      ? t("settings:apiKey.row.neverExpires")
      : t(
          expired
            ? "settings:apiKey.row.expired"
            : "settings:apiKey.row.expires",
          { date: formatDateMedium(expiry.date) },
        );

  return (
    <SettingsRow
      icon={<KeyRoundIcon className={expired ? "opacity-50" : undefined} />}
      title={name}
      titleClassName={expired ? "text-muted-foreground" : undefined}
      badge={
        expired ? (
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
          <span className="truncate">
            {created} · {expiryText}
          </span>
        </span>
      }
    >
      <RowActionsMenu
        label={t("settings:apiKey.row.actions", { name })}
        actions={[
          {
            id: "delete",
            label: t("settings:apiKey.table.delete"),
            icon: Trash2Icon,
            destructive: true,
            onSelect: () => onDelete(apiKey),
          },
        ]}
      />
    </SettingsRow>
  );
}
