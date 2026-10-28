import { useId } from "react";
import { Switch } from "@/components/ui/switch";

type DeliveryActiveRowProps = {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function DeliveryActiveRow({
  title,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: DeliveryActiveRowProps) {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border px-3.5 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p id={titleId} className="text-sm font-medium">
          {title}
        </p>
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
