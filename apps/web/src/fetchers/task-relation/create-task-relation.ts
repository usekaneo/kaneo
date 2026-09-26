import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

async function createTaskRelation({
  sourceTaskId,
  targetTaskId,
  relationType,
}: {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: "subtask" | "blocks" | "related";
}) {
  const response = await client["task-relation"].$post({
    json: {
      sourceTaskId,
      targetTaskId,
      relationType,
    },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  const data = await response.json();

  return data;
}

export default createTaskRelation;
