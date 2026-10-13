import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type WorkspaceRuleActiveRowProps = {
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function WorkspaceRuleActiveRow({
  checked,
  disabled,
  onCheckedChange,
}: WorkspaceRuleActiveRowProps) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3.5 py-3">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id}>
          {t("settings:notificationsPage.ruleActiveLabel")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("settings:notificationsPage.ruleActiveDescription")}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
