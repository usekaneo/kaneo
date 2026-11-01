import { StarIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AgentModelLogo } from "@/components/agent/agent-model-logo";
import { RowActionsMenu } from "@/components/settings/row-actions-menu";
import { SettingsRow } from "@/components/settings/settings-row";
import { Badge } from "@/components/ui/badge";
import type { ModelChoice } from "./types";

type AgentModelRowProps = {
  model: ModelChoice;
  isDefault: boolean;
  canRemove: boolean;
  disabled: boolean;
  onMakeDefault: () => void;
  onRemove: () => void;
};

export function AgentModelRow({
  model,
  isDefault,
  canRemove,
  disabled,
  onMakeDefault,
  onRemove,
}: AgentModelRowProps) {
  const { t } = useTranslation();

  return (
    <SettingsRow
      icon={<AgentModelLogo modelId={model.id} />}
      title={model.label}
      description={model.id}
      badge={
        isDefault ? (
          <Badge variant="secondary">
            {t("settings:adminAgent.defaultBadge")}
          </Badge>
        ) : null
      }
    >
      <RowActionsMenu
        label={t("settings:adminAgent.rowActions", { model: model.label })}
        actions={[
          {
            id: "default",
            label: t("settings:adminAgent.makeDefault"),
            icon: StarIcon,
            disabled: disabled || isDefault,
            onSelect: onMakeDefault,
          },
          {
            id: "remove",
            label: t("settings:adminAgent.remove"),
            icon: Trash2Icon,
            destructive: true,
            disabled: disabled || !canRemove,
            onSelect: onRemove,
          },
        ]}
      />
    </SettingsRow>
  );
}
