import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { taskRelationTable, taskTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { NotFound } from "../../effect/errors";
import { Events } from "../../effect/events";
import { taskRelationById } from "../../effect/lookups";

const deleteTaskRelation = Effect.fn("taskRelation.deleteTaskRelation")(
  function* (id: string, userId: string) {
    const database = yield* Database;
    const events = yield* Events;

    const rel = yield* taskRelationById(id);

    const [task] = yield* database.query((db) =>
      db
        .select({ projectId: taskTable.projectId })
        .from(taskTable)
        .where(eq(taskTable.id, rel.sourceTaskId))
        .limit(1),
    );

    const [relation] = yield* database.query((db) =>
      db
        .delete(taskRelationTable)
        .where(eq(taskRelationTable.id, id))
        .returning(),
    );

    if (!relation) {
      return yield* new NotFound({ entity: "Task relation", id });
    }

    if (task) {
      yield* events.publish("task-relation.deleted", {
        ...relation,
        taskId: rel.sourceTaskId,
        sourceTaskId: rel.sourceTaskId,
        targetTaskId: rel.targetTaskId,
        projectId: task.projectId,
        userId,
      });
    }

    return relation;
  },
);

export default deleteTaskRelation;
