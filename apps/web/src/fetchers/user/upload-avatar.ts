import { client } from "@kaneo/libs";

async function uploadAvatar({
  contentType,
  data,
}: {
  contentType: string;
  data: string;
}) {
  const response = await client.user.avatar.$put({
    json: { contentType, data },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default uploadAvatar;
