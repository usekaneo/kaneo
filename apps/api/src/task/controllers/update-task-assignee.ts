import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { withLockedTask } from "./with-locked-task";
import { publishTaskMutation } from "./task-mutation-effects";
import {
  assertAssignableUsers,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";
import { resolveRequestedAssignees } from "../assignees/assignee-set";
import {
  loadAssigneeIds,
  replaceTaskAssignees,
} from "../assignees/task-assignees";

async function updateTaskAssignee({
  id,
  userId,
  assigneeIds,
  currentUserId,
}: {
  id: string;
  userId?: string | null;
  assigneeIds?: string[];
  currentUserId: string;
}) {
  const { before: existingTask, after: result } = await withLockedTask(
    id,
    async (tx, existingTask) => {
      const current = (await loadAssigneeIds([existingTask], tx)).get(id) ?? [];
      const next = resolveRequestedAssignees(
        { assigneeIds, userId },
        { primary: existingTask.userId, ids: current },
      );
      const unchanged =
        next.length === current.length &&
        next.every((assignee) => current.includes(assignee));
      if (unchanged) {
        return { task: existingTask, added: [], removed: [] };
      }

      const added = next.filter((assignee) => !current.includes(assignee));
      if (added.length > 0) {
        // People who stay assigned were validated when they were added.
        await assertAssignableUsers(
          added,
          await getProjectWorkspaceId(existingTask.projectId, tx),
          existingTask.projectId,
          tx,
        );
      }

      const change = await replaceTaskAssignees(tx, existingTask, next);
      if (
        change.updated === undefined &&
        change.primary !== existingTask.userId
      )
        throw new HTTPException(500, {
          message: "Failed to update task assignee",
        });
      return {
        task: change.updated ?? existingTask,
        added: change.added,
        removed: change.removed,
      };
    },
  );

  await publishTaskMutation(existingTask, result.task, currentUserId, {
    fields: ["userId"],
    assignees: { added: result.added, removed: result.removed },
  });

  const ids = (await loadAssigneeIds([result.task], db)).get(id) ?? [];
  return { ...result.task, assigneeIds: ids };
}

export default updateTaskAssignee;
