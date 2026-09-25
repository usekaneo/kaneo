import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function updateTaskRelation({
  id,
  dependencyType,
  lagDays,
}: {
  id: string;
  dependencyType?: "fs" | "ss" | "ff" | "sf";
  lagDays?: number;
}) {
  const response = await client["task-relation"][":id"].$patch({
    param: { id },
    json: { dependencyType, lagDays },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default updateTaskRelation;
