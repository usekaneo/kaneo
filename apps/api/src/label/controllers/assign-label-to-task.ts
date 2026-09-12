import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { Events } from "../../effect/events";
import {
  LabelAttachFailed,
  LabelNotFound,
  LabelWorkspaceMismatch,
  TaskNotFound,
} from "../errors";
import { LabelSync } from "../label-sync";

const assignLabelToTask = Effect.fn("label.assignLabelToTask")(function* (
  id: string,
  taskId: string,
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

  if (label.workspaceId && label.workspaceId !== task.workspaceId) {
    return yield* new LabelWorkspaceMismatch({ labelId: id, taskId });
  }

  if (label.taskId === taskId) {
    return label;
  }

  const { taskLabel, inserted, previousTaskId, previousName } =
    yield* database.transaction((tx) =>
      Effect.gen(function* () {
        const currentLabel = yield* tx.query((db) =>
          db.query.labelTable.findFirst({
            where: (label, { eq }) => eq(label.id, id),
          }),
        );

        if (!currentLabel) {
          return yield* new LabelNotFound({ id });
        }

        if (
          currentLabel.workspaceId &&
          currentLabel.workspaceId !== task.workspaceId
        ) {
          return yield* new LabelWorkspaceMismatch({ labelId: id, taskId });
        }

        if (currentLabel.taskId === taskId) {
          return {
            taskLabel: currentLabel,
            inserted: false,
            previousTaskId: null,
            previousName: currentLabel.name,
          };
        }

        const previousTaskId = currentLabel.taskId;
        if (previousTaskId) {
          yield* tx.query((db) =>
            db.delete(labelTable).where(eq(labelTable.id, id)),
          );
        }

        const [insertedRow] = yield* tx.query((db) =>
          db
            .insert(labelTable)
            .values({
              name: currentLabel.name,
              color: currentLabel.color,
              taskId,
              workspaceId: task.workspaceId,
            })
            .onConflictDoNothing({
              target: [labelTable.taskId, labelTable.name],
            })
            .returning(),
        );

        if (insertedRow) {
          return {
            taskLabel: insertedRow,
            inserted: true,
            previousTaskId,
            previousName: currentLabel.name,
          };
        }

        const existing = yield* tx.query((db) =>
          db.query.labelTable.findFirst({
            where: and(
              eq(labelTable.taskId, taskId),
              eq(labelTable.name, currentLabel.name),
            ),
          }),
        );

        if (!existing) {
          return yield* new LabelAttachFailed({ id, taskId });
        }

        return {
          taskLabel: existing,
          inserted: false,
          previousTaskId,
          previousName: currentLabel.name,
        };
      }),
    );

  if (previousTaskId) {
    yield* sync.removeFromGitHub(previousTaskId, previousName);
    yield* sync.removeFromGitea(previousTaskId, previousName);
  }

  if (!inserted) {
    return taskLabel;
  }

  yield* sync.syncToGitHub(taskId, taskLabel.name, taskLabel.color);
  yield* sync.syncToGitea(taskId, taskLabel.name, taskLabel.color);

  yield* events.publish("task.label_assigned", {
    label: taskLabel,
    task,
    projectId: task.projectId,
    taskId: task.id,
    userId,
    type: "label_assigned",
  });

  return taskLabel;
});

export default assignLabelToTask;
