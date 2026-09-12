import { and, eq, isNotNull } from "drizzle-orm";
import { Effect } from "effect";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { Events } from "../../effect/events";
import { LabelNotFound, TaskNotFound } from "../errors";
import { LabelSync } from "../label-sync";

const deleteLabel = Effect.fn("label.deleteLabel")(function* (
  id: string,
  userId: string,
) {
  const database = yield* Database;
  const events = yield* Events;
  const sync = yield* LabelSync;

  const label = yield* database.query((db) =>
    db.query.labelTable.findFirst({
      where: (label, { eq }) => eq(label.id, id),
    }),
  );

  if (!label) {
    return yield* new LabelNotFound({ id });
  }

  if (label.taskId) {
    // Task-level label: fetch task, delete with event + GitHub sync
    const taskId = label.taskId;
    const [task] = yield* database.query((db) =>
      db
        .select({
          id: taskTable.id,
          projectId: taskTable.projectId,
          workspaceId: projectTable.workspaceId,
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .where(eq(taskTable.id, taskId))
        .limit(1),
    );

    if (!task) {
      return yield* new TaskNotFound({ taskId });
    }

    const [deletedLabel] = yield* database.query((db) =>
      db.delete(labelTable).where(eq(labelTable.id, id)).returning(),
    );

    if (!deletedLabel) {
      return yield* new LabelNotFound({ id });
    }

    if (deletedLabel.taskId) {
      yield* sync.removeFromGitHub(deletedLabel.taskId, deletedLabel.name);
    }

    yield* events.publish("task.label_deleted", {
      label: deletedLabel,
      task,
      projectId: task.projectId,
      taskId: task.id,
      userId,
      type: "label_deleted",
    });

    return deletedLabel;
  }

  // Workspace-level label: delete the label and cascade to all task-level copies
  const [deletedLabel] = yield* database.query((db) =>
    db.delete(labelTable).where(eq(labelTable.id, id)).returning(),
  );

  if (!deletedLabel) {
    return yield* new LabelNotFound({ id });
  }

  // Label without a workspace: the cascade filter below could never match
  if (label.workspaceId === null) {
    return deletedLabel;
  }

  const workspaceId = label.workspaceId;

  // Capture affected task-level labels before cascading so we have data
  // for events and provider sync
  const affectedLabels = yield* database.query((db) =>
    db
      .select({
        label: labelTable,
        taskId: taskTable.id,
        projectId: projectTable.id,
        workspaceId: projectTable.workspaceId,
      })
      .from(labelTable)
      .innerJoin(taskTable, eq(labelTable.taskId, taskTable.id))
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(
        and(
          eq(labelTable.workspaceId, workspaceId),
          eq(labelTable.name, label.name),
          isNotNull(labelTable.taskId),
        ),
      ),
  );

  // Cascade: delete all task-level copies of this label so existing tasks lose it
  yield* database.query((db) =>
    db
      .delete(labelTable)
      .where(
        and(
          eq(labelTable.workspaceId, workspaceId),
          eq(labelTable.name, label.name),
          isNotNull(labelTable.taskId),
        ),
      ),
  );

  // Emit events and sync providers for each affected task
  for (const { label: l, taskId, projectId } of affectedLabels) {
    if (l.taskId) {
      yield* sync.removeFromGitHub(l.taskId, l.name);
      yield* sync.removeFromGitea(l.taskId, l.name);
    }

    yield* events.publish("task.label_deleted", {
      label: l,
      task: { id: taskId, projectId },
      projectId,
      taskId,
      userId,
      type: "label_deleted",
    });
  }

  return deletedLabel;
});

export default deleteLabel;
