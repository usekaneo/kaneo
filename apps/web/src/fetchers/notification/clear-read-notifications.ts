import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function clearReadNotifications(workspaceId?: string) {
  const response = await client.notification["clear-read"].$delete({
    query: { workspaceId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();
  return data;
}

export default clearReadNotifications;
