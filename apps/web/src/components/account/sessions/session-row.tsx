import { LogOutIcon, MonitorIcon, SmartphoneIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { Button } from "@/components/ui/button";
import type { ActiveSession } from "@/fetchers/user/session-types";
import { formatDateMedium, formatRelativeTime } from "@/lib/format";
import { getSessionDeviceLabel } from "./get-session-device-label";

const MOBILE_SYSTEMS = new Set(["iPhone", "iPad", "Android"]);

type SessionRowProps = {
  session: ActiveSession;
  /** Hidden for the current session: that one ends by signing out. */
  onRevoke?: () => void;
  disabled?: boolean;
};

export function SessionRow({ session, onRevoke, disabled }: SessionRowProps) {
  const { t } = useTranslation();
  const device = getSessionDeviceLabel(session, t);
  const Icon =
    session.os && MOBILE_SYSTEMS.has(session.os) ? SmartphoneIcon : MonitorIcon;
  const details = [
    session.ipAddress,
    t("settings:sessions.lastActive", {
      time: formatRelativeTime(session.lastActiveAt),
    }),
    t("settings:sessions.signedIn", {
      date: formatDateMedium(session.createdAt),
    }),
  ].filter(Boolean);

  return (
    <SettingsRow
      icon={<Icon />}
      title={device}
      badge={
        session.current ? (
          <StatusBadge tone="success">
            {t("settings:sessions.thisDevice")}
          </StatusBadge>
        ) : null
      }
      description={<span className="tabular-nums">{details.join(" / ")}</span>}
    >
      {onRevoke && !session.current ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={t("settings:sessions.revokeLabel", { device })}
          onClick={onRevoke}
        >
          <LogOutIcon aria-hidden="true" />
          {t("settings:sessions.revoke")}
        </Button>
      ) : null}
    </SettingsRow>
  );
}
