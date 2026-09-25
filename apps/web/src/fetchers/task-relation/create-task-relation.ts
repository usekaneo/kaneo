import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function createTaskRelation({
  sourceTaskId,
  targetTaskId,
  relationType,
  dependencyType,
  lagDays,
}: {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: "subtask" | "blocks" | "related";
  // Only meaningful when relationType is "blocks"; ignored by the API
  // otherwise (see create-task-relation.ts on the server).
  dependencyType?: "fs" | "ss" | "ff" | "sf";
  lagDays?: number;
}) {
  const response = await client["task-relation"].$post({
    json: {
      sourceTaskId,
      targetTaskId,
      relationType,
      dependencyType,
      lagDays,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default createTaskRelation;
