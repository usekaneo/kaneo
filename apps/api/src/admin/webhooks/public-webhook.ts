import type { instanceWebhookTable } from "../../database/schema";

export function publicWebhook(row: typeof instanceWebhookTable.$inferSelect) {
  return {
    id: row.id,
    url: row.url,
    categories: row.categories,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}
