import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  CHANNEL_NAME_KEYS,
  type ChannelAvailabilityMap,
  NOTIFICATION_CHANNELS,
  type NotificationChannelId,
} from "../notification-channels";
import { WorkspaceRuleChannelRow } from "./workspace-rule-channel-row";
import {
  RULE_CHANNEL_KEYS,
  type WorkspaceRuleState,
} from "./workspace-rule-state";

type WorkspaceRuleChannelsProps = {
  availability: ChannelAvailabilityMap;
  disabled: boolean;
  state: WorkspaceRuleState;
  onChange: (channel: NotificationChannelId, checked: boolean) => void;
};

export function WorkspaceRuleChannels({
  availability,
  disabled,
  state,
  onChange,
}: WorkspaceRuleChannelsProps) {
  const { t } = useTranslation();
  const headingId = useId();

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium" id={headingId}>
        {t("settings:notificationsPage.ruleChannels")}
      </p>
      <div
        aria-labelledby={headingId}
        className="divide-y divide-border rounded-lg border border-border"
        role="group"
      >
        {NOTIFICATION_CHANNELS.map((channel) => (
          <WorkspaceRuleChannelRow
            key={channel}
            availability={availability[channel]}
            checked={state[RULE_CHANNEL_KEYS[channel]]}
            disabled={disabled}
            name={t(CHANNEL_NAME_KEYS[channel])}
            onCheckedChange={(checked) => onChange(channel, checked)}
          />
        ))}
      </div>
    </div>
  );
}
