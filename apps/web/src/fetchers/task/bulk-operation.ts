import { client } from "@kaneo/libs";

import { HttpError } from "@/lib/http-error";

type BulkOperationType =
  | "updateStatus"
  | "updatePriority"
  | "updateAssignee"
  | "delete"
  | "addLabel"
  | "removeLabel"
  | "updateDueDate"
  | "updateSchedule";

export type BulkScheduleUpdate = {
  taskId: string;
  startDate?: string | null;
  dueDate?: string | null;
};

async function bulkOperation({
  taskIds,
  operation,
  value,
  scheduleUpdates,
}: {
  taskIds: string[];
  operation: BulkOperationType;
  value?: string | null;
  /** Required (and only used) by the `updateSchedule` operation. */
  scheduleUpdates?: BulkScheduleUpdate[];
}) {
  const response = await client.task.bulk.$patch({
    json: { taskIds, operation, value, scheduleUpdates },
  });

  if (!response.ok) {
    throw new HttpError(response.status, await response.text());
  }

  return response.json();
}

export default bulkOperation;
