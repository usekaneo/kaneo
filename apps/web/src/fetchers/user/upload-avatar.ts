import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

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
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default uploadAvatar;
