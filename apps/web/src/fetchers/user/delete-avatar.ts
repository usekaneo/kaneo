import { client } from "@kaneo/libs";

async function deleteAvatar() {
  const response = await client.user.avatar.$delete();

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default deleteAvatar;
