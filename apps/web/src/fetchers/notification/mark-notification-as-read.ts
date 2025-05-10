import { client } from "@kaneo/libs";

async function markNotificationAsRead(id: string) {
  const response = await client.notification[":id"].read.$patch({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default markNotificationAsRead;
