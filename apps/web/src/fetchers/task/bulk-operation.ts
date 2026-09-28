import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

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
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default bulkOperation;
