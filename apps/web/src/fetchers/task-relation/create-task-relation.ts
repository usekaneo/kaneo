import { client } from "@kaneo/libs";

async function createTaskRelation({
  sourceTaskId,
  targetTaskId,
  relationType,
  checklistId,
}: {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: "subtask" | "blocks" | "related";
  /** Subtasks only: which of the parent's checklists to add it to. */
  checklistId?: string;
}) {
  const response = await client["task-relation"].$post({
    json: {
      sourceTaskId,
      targetTaskId,
      relationType,
      ...(checklistId && { checklistId }),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  const data = await response.json();

  return data;
}

export default createTaskRelation;
