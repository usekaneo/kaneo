import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ChannelAvailability } from "../notification-channels";

type ChannelRowProps = {
  channel: string;
  icon: ReactNode;
  name: string;
  description: string;
  detail: string | null;
  availability: ChannelAvailability;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function ChannelRow({
  channel,
  icon,
  name,
  description,
  detail,
  availability,
  open,
  onOpenChange,
  children,
}: ChannelRowProps) {
  const { t } = useTranslation();
  const configured = availability === "available" || availability === "paused";

  const triggerLabel = open
    ? configured
      ? t("settings:notificationsPage.done")
      : t("common:actions.cancel")
    : configured
      ? t("settings:notificationsPage.configure")
      : t("settings:notificationsPage.connect");
  const triggerAccessibleLabel = open
    ? undefined
    : configured
      ? t("settings:notificationsPage.configureChannel", { channel: name })
      : t("settings:notificationsPage.connectChannel", { channel: name });

  return (
    <Collapsible data-channel={channel} open={open} onOpenChange={onOpenChange}>
      <SettingsRow
        icon={icon}
        title={name}
        badge={
          availability === "available" ? (
            <StatusBadge tone="success">
              {t("settings:notificationsPage.statusConnected")}
            </StatusBadge>
          ) : availability === "paused" ? (
            <StatusBadge tone="warning">
              {t("settings:notificationsPage.statusPaused")}
            </StatusBadge>
          ) : null
        }
        description={
          configured && detail ? (
            <span className="font-mono">{detail}</span>
          ) : (
            description
          )
        }
      >
        <CollapsibleTrigger
          aria-label={triggerAccessibleLabel}
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "w-24",
          })}
        >
          {triggerLabel}
        </CollapsibleTrigger>
      </SettingsRow>
      <CollapsiblePanel>
        <div className="border-t border-border bg-muted/30">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
