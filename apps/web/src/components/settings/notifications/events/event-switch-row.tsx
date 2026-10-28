import { SettingsRow } from "@/components/settings/settings-row";
import { Switch } from "@/components/ui/switch";

type EventSwitchRowProps = {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function EventSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
}: EventSwitchRowProps) {
  return (
    <SettingsRow title={title} description={description}>
      <Switch
        aria-label={title}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </SettingsRow>
  );
}
