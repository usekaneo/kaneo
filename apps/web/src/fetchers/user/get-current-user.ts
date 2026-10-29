import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getCurrentUser() {
  const response = await client.user.me.$get();

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default getCurrentUser;
