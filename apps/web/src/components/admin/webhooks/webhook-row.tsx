import {
  HistoryIcon,
  KeyRoundIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AUDIT_LOG_CATEGORIES } from "@/components/admin/audit-log/audit-log-categories";
import { RowActionsMenu } from "@/components/settings/row-actions-menu";
import { Badge } from "@/components/ui/badge";
import type { AdminWebhook } from "@/fetchers/admin/webhook-types";

type Props = {
  webhook: AdminWebhook;
  signingConfigured: boolean;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRotate: () => void;
  onTest: () => void;
  onHistory: () => void;
};
export function WebhookRow({
  webhook,
  signingConfigured,
  pending,
  onEdit,
  onDelete,
  onRotate,
  onTest,
  onHistory,
}: Props) {
  const { t } = useTranslation();
  return (
    <div role="listitem" className="flex items-center gap-4 px-4 py-4">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium" title={webhook.url}>
            {webhook.url}
          </span>
          <Badge variant={webhook.enabled ? "success" : "secondary"}>
            {webhook.enabled
              ? t("settings:adminWebhooks.enabled")
              : t("settings:adminWebhooks.disabled")}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          {AUDIT_LOG_CATEGORIES.filter(
            (category) =>
              category.value !== "" &&
              webhook.categories.includes(category.value),
          ).map((category) => (
            <Badge key={category.value} variant="outline">
              {t(category.labelKey)}
            </Badge>
          ))}
        </div>
      </div>
      <RowActionsMenu
        label={t("settings:adminWebhooks.actions", { url: webhook.url })}
        actions={[
          {
            id: "edit",
            label: t("settings:adminWebhooks.edit"),
            icon: PencilIcon,
            onSelect: onEdit,
            disabled: pending,
          },
          {
            id: "history",
            label: t("settings:adminWebhooks.deliveries"),
            icon: HistoryIcon,
            onSelect: onHistory,
          },
          {
            id: "test",
            label: t("settings:adminWebhooks.sendTest"),
            icon: SendIcon,
            onSelect: onTest,
            disabled: pending || !webhook.enabled,
          },
          {
            id: "rotate",
            label: t("settings:adminWebhooks.rotate"),
            icon: KeyRoundIcon,
            onSelect: onRotate,
            disabled: pending || !signingConfigured,
          },
          {
            id: "delete",
            label: t("common:actions.delete"),
            icon: Trash2Icon,
            onSelect: onDelete,
            destructive: true,
            disabled: pending,
          },
        ]}
      />
    </div>
  );
}
