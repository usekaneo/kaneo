import type { TFunction } from "i18next";
import {
  CHANNEL_NAME_KEYS,
  type ChannelAvailabilityMap,
  NOTIFICATION_CHANNELS,
} from "../notification-channels";
import { RULE_CHANNEL_KEYS, type WorkspaceRule } from "./workspace-rule-state";

export function getWorkspaceRuleSummary(
  rule: WorkspaceRule | undefined,
  availability: ChannelAvailabilityMap,
  t: TFunction,
) {
  const onlyInKaneo = t("settings:notificationsPage.onlyInKaneo");
  if (!rule) return onlyInKaneo;

  const channels = NOTIFICATION_CHANNELS.filter(
    (channel) =>
      rule[RULE_CHANNEL_KEYS[channel]] && availability[channel] === "available",
  ).map((channel) => t(CHANNEL_NAME_KEYS[channel]));

  if (channels.length === 0) return onlyInKaneo;

  const projects =
    rule.projectMode === "all"
      ? t("settings:notificationsPage.allProjects")
      : t("settings:notificationsPage.projectCount", {
          count: rule.selectedProjectIds.length,
        });

  return t("settings:notificationsPage.ruleSummary", {
    channels: channels.join(", "),
    projects,
  });
}
