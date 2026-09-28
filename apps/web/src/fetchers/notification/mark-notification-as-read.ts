import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function markNotificationAsRead(id: string) {
  const response = await client.notification[":id"].read.$patch({
    param: { id },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();
  return data;
}

export default markNotificationAsRead;
