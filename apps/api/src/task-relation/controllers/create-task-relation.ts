import { and, eq, or } from "drizzle-orm";
import { Effect } from "effect";
import { findTaskRefInWorkspace } from "../../database/lookups";
import { taskRelationTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { Events } from "../../effect/events";
import {
  RelatedTaskNotFound,
  RelationAlreadyExists,
  RelationCreateFailed,
  SelfRelation,
} from "../errors";

const createTaskRelation = Effect.fn("taskRelation.createTaskRelation")(
  function* ({
    sourceTaskId,
    targetTaskId,
    relationType,
    userId,
    workspaceId,
  }: {
    sourceTaskId: string;
    targetTaskId: string;
    relationType: string;
    userId: string;
    workspaceId: string;
  }) {
    const database = yield* Database;
    const events = yield* Events;

    if (sourceTaskId === targetTaskId) {
      return yield* new SelfRelation({ taskId: sourceTaskId });
    }

    const [sourceTask] = yield* database.query((db) =>
      findTaskRefInWorkspace(sourceTaskId, workspaceId, db),
    );

    if (!sourceTask) {
      return yield* new RelatedTaskNotFound({
        role: "Source",
        taskId: sourceTaskId,
      });
    }

    const [targetTask] = yield* database.query((db) =>
      findTaskRefInWorkspace(targetTaskId, workspaceId, db),
    );

    if (!targetTask) {
      return yield* new RelatedTaskNotFound({
        role: "Target",
        taskId: targetTaskId,
      });
    }

    const existing = yield* database.query((db) =>
      db
        .select({ id: taskRelationTable.id })
        .from(taskRelationTable)
        .where(
          and(
            eq(taskRelationTable.relationType, relationType),
            or(
              and(
                eq(taskRelationTable.sourceTaskId, sourceTaskId),
                eq(taskRelationTable.targetTaskId, targetTaskId),
              ),
              and(
                eq(taskRelationTable.sourceTaskId, targetTaskId),
                eq(taskRelationTable.targetTaskId, sourceTaskId),
              ),
            ),
          ),
        )
        .limit(1),
    );

    if (existing.length > 0) {
      return yield* new RelationAlreadyExists({
        sourceTaskId,
        targetTaskId,
        relationType,
      });
    }

    const [relation] = yield* database.query((db) =>
      db
        .insert(taskRelationTable)
        .values({
          sourceTaskId,
          targetTaskId,
          relationType,
        })
        .returning(),
    );

    if (!relation) {
      return yield* new RelationCreateFailed({ sourceTaskId, targetTaskId });
    }

    yield* events.publish("task-relation.created", {
      ...relation,
      taskId: sourceTaskId,
      projectId: sourceTask.projectId,
      userId,
    });

    return relation;
  },
);

export default createTaskRelation;
