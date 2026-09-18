import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { NotFound } from "../../../apps/api/src/effect/errors";
import {
  makeTestDatabase,
  makeTestEvents,
} from "../../../apps/api/src/effect/testing";
import createTaskRelation from "../../../apps/api/src/task-relation/controllers/create-task-relation";
import deleteTaskRelation from "../../../apps/api/src/task-relation/controllers/delete-task-relation";
import {
  RelatedTaskNotFound,
  RelationAlreadyExists,
  SelfRelation,
} from "../../../apps/api/src/task-relation/errors";

const RELATION = {
  id: "rel-1",
  sourceTaskId: "task-1",
  targetTaskId: "task-2",
  relationType: "blocks",
  createdAt: new Date("2026-09-18T10:00:00.000Z"),
};

const SOURCE = { id: "task-1", projectId: "proj-1", workspaceId: "ws-1" };
const TARGET = { id: "task-2", projectId: "proj-1", workspaceId: "ws-1" };

function failureOf(effect: Effect.Effect<unknown, unknown>) {
  return Effect.runPromise(effect).then(
    () => {
      throw new Error("expected the effect to fail");
    },
    (error: unknown) => error,
  );
}

function selectSequence(results: unknown[][]) {
  const queue = [...results];
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(queue.shift() ?? []),
  };
  return () => chain;
}

function returning(rows: unknown[]) {
  const terminal = { returning: () => Promise.resolve(rows) };
  return () => ({ values: () => terminal, where: () => terminal });
}

const input = {
  sourceTaskId: "task-1",
  targetTaskId: "task-2",
  relationType: "blocks",
  userId: "user-1",
  workspaceId: "ws-1",
};

describe("task-relation controllers through the Effect test layers", () => {
  it("rejects a self relation before touching the database", async () => {
    const database = makeTestDatabase({});
    const events = makeTestEvents();

    const error = await failureOf(
      Effect.provide(
        createTaskRelation({ ...input, targetTaskId: "task-1" }),
        Layer.mergeAll(database, events.layer),
      ),
    );

    expect(error).toBeInstanceOf(SelfRelation);
  });

  it("names the missing side of the relation", async () => {
    const database = makeTestDatabase({
      select: selectSequence([[SOURCE], []]),
    });
    const events = makeTestEvents();

    const error = await failureOf(
      Effect.provide(
        createTaskRelation(input),
        Layer.mergeAll(database, events.layer),
      ),
    );

    expect(error).toBeInstanceOf(RelatedTaskNotFound);
    expect(error).toMatchObject({ role: "Target", taskId: "task-2" });
  });

  it("rejects a duplicate relation in either direction", async () => {
    const database = makeTestDatabase({
      select: selectSequence([[SOURCE], [TARGET], [{ id: "rel-0" }]]),
    });
    const events = makeTestEvents();

    const error = await failureOf(
      Effect.provide(
        createTaskRelation(input),
        Layer.mergeAll(database, events.layer),
      ),
    );

    expect(error).toBeInstanceOf(RelationAlreadyExists);
    expect(events.published).toEqual([]);
  });

  it("creates the relation and publishes task-relation.created", async () => {
    const database = makeTestDatabase({
      select: selectSequence([[SOURCE], [TARGET], []]),
      insert: returning([RELATION]),
    });
    const events = makeTestEvents();

    const result = await Effect.runPromise(
      Effect.provide(
        createTaskRelation(input),
        Layer.mergeAll(database, events.layer),
      ),
    );

    expect(result).toEqual(RELATION);
    expect(events.published).toEqual([
      {
        type: "task-relation.created",
        data: {
          ...RELATION,
          taskId: "task-1",
          projectId: "proj-1",
          userId: "user-1",
        },
      },
    ]);
  });

  it("deleteTaskRelation fails with NotFound for an unknown relation", async () => {
    const database = makeTestDatabase({ select: selectSequence([[]]) });
    const events = makeTestEvents();

    const error = await failureOf(
      Effect.provide(
        deleteTaskRelation("missing", "user-1"),
        Layer.mergeAll(database, events.layer),
      ),
    );

    expect(error).toBeInstanceOf(NotFound);
    expect(error).toMatchObject({ entity: "Task relation", id: "missing" });
  });

  it("deleteTaskRelation publishes task-relation.deleted with both task ids", async () => {
    const database = makeTestDatabase({
      select: selectSequence([
        [{ sourceTaskId: "task-1", targetTaskId: "task-2" }],
        [{ projectId: "proj-1" }],
      ]),
      delete: returning([RELATION]),
    });
    const events = makeTestEvents();

    await Effect.runPromise(
      Effect.provide(
        deleteTaskRelation("rel-1", "user-1"),
        Layer.mergeAll(database, events.layer),
      ),
    );

    expect(events.published).toEqual([
      {
        type: "task-relation.deleted",
        data: {
          ...RELATION,
          taskId: "task-1",
          sourceTaskId: "task-1",
          targetTaskId: "task-2",
          projectId: "proj-1",
          userId: "user-1",
        },
      },
    ]);
  });
});
