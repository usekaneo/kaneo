import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function getExternalLinks(taskId: string) {
  const response = await client["external-link"].task[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  const data = await response.json();

  return data;
}

export default getExternalLinks;
