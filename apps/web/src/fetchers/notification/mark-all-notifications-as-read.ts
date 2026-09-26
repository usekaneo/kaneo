import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function markAllNotificationsAsRead() {
  const response = await client.notification["read-all"].$patch();

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default markAllNotificationsAsRead;
