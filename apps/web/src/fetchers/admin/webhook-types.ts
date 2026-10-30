import type { getAdminWebhooks } from "./get-admin-webhooks";
export type AdminWebhook = Awaited<
  ReturnType<typeof getAdminWebhooks>
>["webhooks"][number];
export type AdminWebhookValues = Pick<
  AdminWebhook,
  "url" | "categories" | "enabled"
>;
