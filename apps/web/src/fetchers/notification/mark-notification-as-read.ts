import { trpcClient } from "@/utils/trpc";

async function markNotificationAsRead(id: string) {
  return await trpcClient.notification.markAsRead.mutate({ id });
}

export default markNotificationAsRead;
