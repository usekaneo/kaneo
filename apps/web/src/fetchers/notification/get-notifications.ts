import { trpcClient } from "@/utils/trpc";

async function getNotifications() {
  return await trpcClient.notification.list.query({});
}

export default getNotifications;
