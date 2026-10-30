import { type ReactNode, useId } from "react";
import { SettingsRow } from "@/components/settings/settings-row";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type PreferenceSwitchRowProps = {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function PreferenceSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
}: PreferenceSwitchRowProps) {
  const id = useId();

  return (
    <SettingsRow
      className="flex-row items-center gap-6"
      title={<Label htmlFor={id}>{title}</Label>}
      description={description}
    >
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </SettingsRow>
  );
}
