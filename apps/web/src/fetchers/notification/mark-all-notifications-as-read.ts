import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function markAllNotificationsAsRead(workspaceId?: string) {
  const response = await client.notification["read-all"].$patch({
    query: { workspaceId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();
  return data;
}

export default markAllNotificationsAsRead;
