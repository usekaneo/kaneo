import { trpcClient } from "@/utils/trpc";

async function clearNotifications() {
  return await trpcClient.notification.clear.mutate();
}

export default clearNotifications;
