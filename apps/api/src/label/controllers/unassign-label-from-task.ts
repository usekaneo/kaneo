import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { labelTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { Events } from "../../effect/events";
import { labelById, taskRefById } from "../../effect/lookups";
import { LabelDetachFailed, LabelNotAssigned } from "../errors";
import { LabelSync } from "../label-sync";

const unassignLabelFromTask = Effect.fn("label.unassignLabelFromTask")(
  function* (id: string, userId: string) {
    const database = yield* Database;
    const events = yield* Events;
    const sync = yield* LabelSync;

    const label = yield* labelById(id);

    if (!label.taskId) {
      return yield* new LabelNotAssigned({ id });
    }

    const task = yield* taskRefById(label.taskId);

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
