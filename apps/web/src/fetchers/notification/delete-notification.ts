import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function deleteNotification(id: string) {
  const response = await client.notification[":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();
  return data;
}

export default deleteNotification;
