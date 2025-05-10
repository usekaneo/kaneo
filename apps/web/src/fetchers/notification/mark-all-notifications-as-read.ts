import { client } from "@kaneo/libs";

async function markAllNotificationsAsRead() {
  const response = await client.notification["read-all"].$patch();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default markAllNotificationsAsRead;
