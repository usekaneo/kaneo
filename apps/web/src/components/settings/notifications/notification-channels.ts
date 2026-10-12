export type ExternalChannelId = "gotify" | "ntfy" | "webhook";

export type NotificationChannelId = "email" | ExternalChannelId;

export type ChannelAvailability =
  | "available"
  | "paused"
  | "off"
  | "notConnected";

export type ChannelAvailabilityMap = Record<
  NotificationChannelId,
  ChannelAvailability
>;

export const NOTIFICATION_CHANNELS: NotificationChannelId[] = [
  "email",
  "gotify",
  "ntfy",
  "webhook",
];

export const CHANNEL_NAME_KEYS: Record<NotificationChannelId, string> = {
  email: "settings:notificationsPage.emailTitle",
  gotify: "settings:notificationsPage.gotifyTitle",
  ntfy: "settings:notificationsPage.ntfyTitle",
  webhook: "settings:notificationsPage.webhookTitle",
};
