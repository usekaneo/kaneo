import { client } from "@kaneo/libs";

type BulkOperationType =
  | "updateStatus"
  | "updatePriority"
  | "updateAssignee"
  | "delete"
  | "addLabel"
  | "removeLabel"
  | "updateDueDate";

async function bulkOperation({
  taskIds,
  operation,
  value,
}: {
  taskIds: string[];
  operation: BulkOperationType;
  value?: string | null;
}) {
  const response = await client.task.bulk.$patch({
    json: { taskIds, operation, value },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default bulkOperation;
