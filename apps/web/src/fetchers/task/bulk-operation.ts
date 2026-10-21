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
  assigneeMode,
}: {
  taskIds: string[];
  operation: BulkOperationType;
  value?: string | null;
  assigneeMode?: "set" | "add" | "remove";
}) {
  const response = await client.task.bulk.$patch({
    json: { taskIds, operation, value, assigneeMode },
  });

  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }

  return response.json();
}

export default bulkOperation;
