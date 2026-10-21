import { publishEvent } from "../../events";
import type { TaskAssignee } from "./get-task-assignees";

export async function publishAssigneeChanges(
  task: { id: string; projectId: string; title: string },
  before: TaskAssignee[],
  after: TaskAssignee[],
  actorId?: string,
) {
  for (const person of before.filter(
    (person) => !after.some((next) => next.id === person.id),
  )) {
    await publishEvent("task.assignee_removed", {
      taskId: task.id,
      projectId: task.projectId,
      title: task.title,
      userId: actorId,
      removedAssigneeId: person.id,
      removedAssignee: person.name,
      type: "assignee_removed",
    });
  }
  for (const person of after.filter(
    (person) => !before.some((previous) => previous.id === person.id),
  )) {
    await publishEvent("task.assignee_changed", {
      taskId: task.id,
      projectId: task.projectId,
      title: task.title,
      userId: actorId,
      oldAssignee: null,
      newAssigneeId: person.id,
      newAssignee: person.name,
      type: "assignee_changed",
    });
  }
  if (before.length && !after.length)
    await publishEvent("task.unassigned", {
      taskId: task.id,
      projectId: task.projectId,
      title: task.title,
      userId: actorId,
      type: "unassigned",
    });
}
