import type db from "../../database";
import {
  activityTable,
  taskAssigneeTable,
  taskTable,
} from "../../database/schema";
import { chunk } from "./chunk";
import type { PlannedImportTask } from "./plan-import-tasks";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function writeImportTasks(
  tx: Transaction,
  projectId: string,
  importedBy: string,
  tasks: readonly PlannedImportTask[],
) {
  for (const batch of chunk(tasks)) {
    await tx.insert(taskTable).values(
      batch.map((task) => ({
        id: task.id,
        projectId,
        number: task.number,
        title: task.title,
        description: task.description,
        status: task.status,
        columnId: task.columnId,
        position: task.position,
        priority: task.priority,
        startDate: task.startDate,
        dueDate: task.dueDate,
        createdAt: task.createdAt,
        userId: task.userId,
      })),
    );

    const assigned = batch.filter((task) => task.userId);
    if (assigned.length > 0) {
      await tx.insert(taskAssigneeTable).values(
        assigned.map((task) => ({
          taskId: task.id,
          userId: task.userId as string,
        })),
      );
    }

    await tx.insert(activityTable).values(
      batch.map((task) => ({
        taskId: task.id,
        type: "created",
        userId: importedBy,
        content: null,
        eventData: {},
        createdAt: task.createdAt,
      })),
    );
  }
}
