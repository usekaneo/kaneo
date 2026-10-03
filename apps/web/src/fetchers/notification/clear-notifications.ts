import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function clearNotifications(workspaceId?: string) {
  const response = await client.notification["clear-all"].$delete({
    query: { workspaceId },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default clearNotifications;
