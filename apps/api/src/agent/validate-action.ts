import db from "../database";
import { codeRepository } from "./code/repository";
import { assertAssignableUser } from "../utils/assert-assignable-user";
import { validateDateRange } from "../utils/validate-dates";
import {
  assertRequiredCustomFields,
  assertValidTaskStatus,
} from "../task/validate-task-fields";
import {
  assertAgentAccess,
  assertAgentProject,
  type AgentDatabase,
} from "./access";
import { actionPermissions } from "./action-permissions";
import { getScopedTask } from "./controllers/get-scoped-task";
import { taskSnapshot } from "./snapshot";
import type { AgentAction, AgentSubject } from "./types";

export async function validateAction(
  subject: AgentSubject,
  action: AgentAction,
  database: AgentDatabase = db,
) {
  await assertAgentAccess(subject, actionPermissions(action), database);
  if (action.type === "code.run") {
    const { task } = await codeRepository(
      subject,
      action.taskId,
      action.integrationId,
      database,
    );
    return taskSnapshot(task);
  }
  if (action.type === "task.create") {
    await assertAgentProject(subject, action.projectId, database);
    await assertValidTaskStatus(action.status, action.projectId, database);
    await assertRequiredCustomFields(action.projectId, [], database);
    if (action.userId)
      await assertAssignableUser(
        action.userId,
        subject.workspaceId,
        action.projectId,
        database,
      );
    return null;
  }
  const task = await getScopedTask(subject, action.taskId, database);
  if (action.type === "comment.create") return taskSnapshot(task);
  if (action.patch.userId)
    await assertAssignableUser(
      action.patch.userId,
      subject.workspaceId,
      task.projectId,
      database,
    );
  if (action.patch.dueDate !== undefined)
    validateDateRange(
      task.startDate,
      action.patch.dueDate ? new Date(action.patch.dueDate) : null,
    );
  return taskSnapshot(task);
}
