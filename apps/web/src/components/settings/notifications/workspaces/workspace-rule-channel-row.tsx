import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import type { ChannelAvailability } from "../notification-channels";

const UNAVAILABLE_REASON_KEYS: Record<
  Exclude<ChannelAvailability, "available">,
  string
> = {
  paused: "settings:notificationsPage.statusPaused",
  off: "settings:notificationsPage.channelOff",
  notConnected: "settings:notificationsPage.channelNotConnected",
};

type WorkspaceRuleChannelRowProps = {
  name: string;
  availability: ChannelAvailability;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function WorkspaceRuleChannelRow({
  name,
  availability,
  checked,
  disabled,
  onCheckedChange,
}: WorkspaceRuleChannelRowProps) {
  const { t } = useTranslation();
  const id = useId();
  const available = availability === "available";

  return (
    <div className="flex min-h-11 items-center gap-3 px-3.5 py-2">
      <Label
        className={cn(
          "min-w-0 flex-1 font-normal",
          !available && "text-muted-foreground",
        )}
        htmlFor={id}
      >
        {name}
      </Label>
      {available ? null : (
        <span className="text-xs text-muted-foreground">
          {t(UNAVAILABLE_REASON_KEYS[availability])}
        </span>
      )}
      <Switch
        checked={available && checked}
        disabled={!available || disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
