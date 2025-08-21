import { trpcClient } from "@/utils/trpc";

async function markAllNotificationsAsRead() {
  return await trpcClient.notification.markAllAsRead.mutate();
}

export default markAllNotificationsAsRead;
