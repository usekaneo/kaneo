import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function deleteTaskRelation(id: string) {
  const response = await client["task-relation"][":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default deleteTaskRelation;
