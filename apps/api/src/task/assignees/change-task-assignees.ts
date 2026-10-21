import { publishEvent } from "../../events";
import { withLockedTask } from "../controllers/with-locked-task";
import { getTaskAssignees } from "./get-task-assignees";
import { writeTaskAssignees } from "./write-task-assignees";
import { publishAssigneeChanges } from "./publish-assignee-changes";

export async function changeTaskAssignees({
  id,
  userIds,
  mode,
  currentUserId,
}: {
  id: string;
  userIds: string[];
  mode: "set" | "add" | "remove";
  currentUserId: string;
}) {
  const { after } = await withLockedTask(id, async (tx, before) => {
    const current = (await getTaskAssignees([id], tx)).get(id) ?? [];
    const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
    const next =
      mode === "set"
        ? ids
        : mode === "add"
          ? [...new Set([...current.map((person) => person.id), ...ids])]
          : current
              .map((person) => person.id)
              .filter((id) => !ids.includes(id));
    if (
      next.length === current.length &&
      next.every((id, index) => id === current[index]?.id)
    )
      return { task: before, current, assignees: current, changed: false };
    const task = await writeTaskAssignees(tx, before, next);
    const assignees = (await getTaskAssignees([id], tx)).get(id) ?? [];
    return { task, current, assignees, changed: true };
  });
  if (after.changed) {
    await publishAssigneeChanges(
      after.task,
      after.current,
      after.assignees,
      currentUserId,
    );
    await publishEvent("task.updated", {
      taskId: id,
      projectId: after.task.projectId,
      userId: currentUserId,
    });
  }
  return { ...after.task, assignees: after.assignees };
}
