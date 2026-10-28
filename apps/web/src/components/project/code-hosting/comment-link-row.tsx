import { useId } from "react";
import { IntegrationPanelRow } from "@/components/project/integrations/panel/integration-panel-row";
import { Switch } from "@/components/ui/switch";

type CommentLinkRowProps = {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function CommentLinkRow({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: CommentLinkRowProps) {
  const id = useId();

  return (
    <IntegrationPanelRow
      title={<span id={`${id}-title`}>{title}</span>}
      description={<span id={`${id}-description`}>{description}</span>}
    >
      <Switch
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </IntegrationPanelRow>
  );
}
