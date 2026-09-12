import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { Events } from "../../effect/events";
import {
  LabelDetachFailed,
  LabelNotAssigned,
  LabelNotFound,
  TaskNotFound,
} from "../errors";
import { LabelSync } from "../label-sync";

const unassignLabelFromTask = Effect.fn("label.unassignLabelFromTask")(
  function* (id: string, userId: string) {
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

    if (!label.taskId) {
      return yield* new LabelNotAssigned({ id });
    }

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
      return yield* new LabelDetachFailed({ id });
    }

    if (deletedLabel.taskId) {
      yield* sync.removeFromGitHub(deletedLabel.taskId, deletedLabel.name);
    }

    yield* events.publish("task.label_unassigned", {
      label: deletedLabel,
      task,
      projectId: task.projectId,
      taskId: deletedLabel.taskId,
      userId,
      type: "label_unassigned",
    });

    return deletedLabel;
  },
);

export default unassignLabelFromTask;
