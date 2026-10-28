import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function deleteAvatar() {
  const response = await client.user.avatar.$delete();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default deleteAvatar;
