import { and, eq, isNull, sql } from "drizzle-orm";
import { Effect } from "effect";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { Events } from "../../effect/events";
import { TaskNotFound } from "../errors";
import { LabelSync } from "../label-sync";

const createLabel = Effect.fn("label.createLabel")(function* (
  name: string,
  color: string,
  taskId: string | undefined,
  workspaceId: string,
  userId: string,
) {
  const database = yield* Database;

  if (taskId) {
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

    if (task.workspaceId !== workspaceId) {
      return yield* new TaskNotFound({ taskId });
    }

    const [inserted] = yield* database.query((db) =>
      db
        .insert(labelTable)
        .values({ name, color, taskId, workspaceId: task.workspaceId })
        .onConflictDoNothing({
          target: [labelTable.taskId, labelTable.name],
        })
        .returning(),
    );

    const label =
      inserted ??
      (yield* database.query((db) =>
        db.query.labelTable.findFirst({
          where: and(eq(labelTable.taskId, taskId), eq(labelTable.name, name)),
        }),
      ));

    if (!label) {
      return yield* Effect.die(new Error("Failed to create or resolve label"));
    }

    if (inserted) {
      const sync = yield* LabelSync;
      yield* sync.syncToGitHub(taskId, name, color);
      yield* sync.syncToGitea(taskId, name, color);

      const events = yield* Events;
      yield* events.publish("task.label_created", {
        projectId: task.projectId,
        taskId: task.id,
        userId: userId,
        type: "label_created",
      });
    }
    return label;
  }

  const [inserted] = yield* database.query((db) =>
    db
      .insert(labelTable)
      .values({ name, color, taskId: null, workspaceId })
      .onConflictDoNothing({
        target: [labelTable.workspaceId, labelTable.name],
        where: sql`${labelTable.taskId} is null`,
      })
      .returning(),
  );

  const label =
    inserted ??
    (yield* database.query((db) =>
      db.query.labelTable.findFirst({
        where: and(
          eq(labelTable.workspaceId, workspaceId),
          eq(labelTable.name, name),
          isNull(labelTable.taskId),
        ),
      }),
    ));

  if (!label) {
    return yield* Effect.die(new Error("Failed to create or resolve label"));
  }

  return label;
});

export default createLabel;
