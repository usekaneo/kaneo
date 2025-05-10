import { client } from "@kaneo/libs";

async function getNotifications() {
  const response = await client.notification.$get();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();
  return data;
}

export default getNotifications;
