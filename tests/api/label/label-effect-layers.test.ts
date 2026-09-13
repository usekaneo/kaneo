import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  makeTestDatabase,
  makeTestEvents,
} from "../../../apps/api/src/effect/testing";
import createLabel from "../../../apps/api/src/label/controllers/create-label";
import getLabel from "../../../apps/api/src/label/controllers/get-label";
import unassignLabelFromTask from "../../../apps/api/src/label/controllers/unassign-label-from-task";
import updateLabel from "../../../apps/api/src/label/controllers/update-label";
import {
  LabelNotAssigned,
  LabelNotFound,
} from "../../../apps/api/src/label/errors";
import { LabelSync } from "../../../apps/api/src/label/label-sync";

const WORKSPACE_LABEL = {
  id: "label-ws-1",
  name: "bug",
  color: "EF4444",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: null,
  workspaceId: "ws-1",
};

const TASK_LABEL = { ...WORKSPACE_LABEL, id: "label-task-1", taskId: "task-1" };

const TASK = { id: "task-1", projectId: "proj-1", workspaceId: "ws-1" };

function failureOf(effect: Effect.Effect<unknown, unknown>) {
  return Effect.runPromise(effect).then(
    () => {
      throw new Error("expected the effect to fail");
    },
    (error: unknown) => error,
  );
}

function makeTestLabelSync() {
  const calls: { method: string; args: string[] }[] = [];
  const record =
    (method: string) =>
    (...args: string[]) =>
      Effect.sync(() => {
        calls.push({ method, args });
      });
  const layer = Layer.succeed(LabelSync, {
    syncToGitHub: record("syncToGitHub"),
    removeFromGitHub: record("removeFromGitHub"),
    syncToGitea: record("syncToGitea"),
    removeFromGitea: record("removeFromGitea"),
  });
  return { layer, calls };
}

function selectReturning(rows: unknown[]) {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
  };
  return () => chain;
}

function deleteReturning(rows: unknown[]) {
  return () => ({
    where: () => ({ returning: () => Promise.resolve(rows) }),
  });
}

function insertReturning(rows: unknown[]) {
  return () => ({
    values: () => ({
      onConflictDoNothing: () => ({ returning: () => Promise.resolve(rows) }),
    }),
  });
}

function updateRecorder(returning: unknown[]) {
  const calls: { set: unknown; where: unknown }[] = [];
  const update = () => {
    const call = { set: undefined as unknown, where: undefined as unknown };
    calls.push(call);
    const whereResult = Object.assign(Promise.resolve(undefined), {
      returning: () => Promise.resolve(returning),
    });
    return {
      set: (set: unknown) => {
        call.set = set;
        return {
          where: (where: unknown) => {
            call.where = where;
            return whereResult;
          },
        };
      },
    };
  };
  return { update, calls };
}

describe("label controllers through the Effect test layers", () => {
  it("getLabel fails with LabelNotFound when no row matches", async () => {
    const database = makeTestDatabase({
      query: { labelTable: { findFirst: () => Promise.resolve(undefined) } },
    });

    const error = await failureOf(
      Effect.provide(getLabel("missing"), database),
    );

    expect(error).toBeInstanceOf(LabelNotFound);
    expect((error as LabelNotFound).id).toBe("missing");
  });

  it("getLabel returns the row", async () => {
    const database = makeTestDatabase({
      query: {
        labelTable: { findFirst: () => Promise.resolve(WORKSPACE_LABEL) },
      },
    });

    await expect(
      Effect.runPromise(Effect.provide(getLabel("label-ws-1"), database)),
    ).resolves.toEqual(WORKSPACE_LABEL);
  });

  it("unassignLabelFromTask rejects a workspace definition with LabelNotAssigned", async () => {
    const database = makeTestDatabase({
      query: {
        labelTable: { findFirst: () => Promise.resolve(WORKSPACE_LABEL) },
      },
    });
    const events = makeTestEvents();
    const sync = makeTestLabelSync();

    const error = await failureOf(
      Effect.provide(
        unassignLabelFromTask("label-ws-1", "user-1"),
        Layer.mergeAll(database, events.layer, sync.layer),
      ),
    );

    expect(error).toBeInstanceOf(LabelNotAssigned);
    expect(events.published).toEqual([]);
    expect(sync.calls).toEqual([]);
  });

  it("unassignLabelFromTask deletes the assignment, syncs GitHub, and publishes the event", async () => {
    const database = makeTestDatabase({
      query: { labelTable: { findFirst: () => Promise.resolve(TASK_LABEL) } },
      select: selectReturning([TASK]),
      delete: deleteReturning([TASK_LABEL]),
    });
    const events = makeTestEvents();
    const sync = makeTestLabelSync();

    const result = await Effect.runPromise(
      Effect.provide(
        unassignLabelFromTask("label-task-1", "user-1"),
        Layer.mergeAll(database, events.layer, sync.layer),
      ),
    );

    expect(result).toEqual(TASK_LABEL);
    expect(sync.calls).toEqual([
      { method: "removeFromGitHub", args: ["task-1", "bug"] },
    ]);
    expect(events.published).toEqual([
      {
        type: "task.label_unassigned",
        data: {
          label: TASK_LABEL,
          task: TASK,
          projectId: "proj-1",
          taskId: "task-1",
          userId: "user-1",
          type: "label_unassigned",
        },
      },
    ]);
  });

  it("updateLabel cascades a workspace label rename to task copies inside the transaction", async () => {
    const updated = { ...WORKSPACE_LABEL, name: "defect", color: "111111" };
    const { update, calls } = updateRecorder([updated]);
    const transactionClient = {
      query: {
        labelTable: { findFirst: () => Promise.resolve(WORKSPACE_LABEL) },
      },
      update,
    };
    let committed = false;
    const database = makeTestDatabase({
      transaction: async (body: (tx: unknown) => Promise<unknown>) => {
        const result = await body(transactionClient);
        committed = true;
        return result;
      },
    });

    const result = await Effect.runPromise(
      Effect.provide(updateLabel("label-ws-1", "defect", "111111"), database),
    );

    expect(result).toEqual(updated);
    expect(committed).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.set).toEqual({ name: "defect", color: "111111" });
    expect(calls[1]?.set).toEqual({ name: "defect", color: "111111" });
  });

  it("updateLabel fails with LabelNotFound and never updates when the label is missing", async () => {
    const { update, calls } = updateRecorder([]);
    const database = makeTestDatabase({
      transaction: async (body: (tx: unknown) => Promise<unknown>) =>
        body({
          query: {
            labelTable: { findFirst: () => Promise.resolve(undefined) },
          },
          update,
        }),
    });

    const error = await failureOf(
      Effect.provide(updateLabel("missing", "x", "y"), database),
    );

    expect(error).toBeInstanceOf(LabelNotFound);
    expect(calls).toEqual([]);
  });

  it("createLabel keeps the unresolved-label defect as a plain Error", async () => {
    const database = makeTestDatabase({
      insert: insertReturning([]),
      query: { labelTable: { findFirst: () => Promise.resolve(undefined) } },
    });
    const events = makeTestEvents();
    const sync = makeTestLabelSync();

    const error = await failureOf(
      Effect.provide(
        createLabel("bug", "EF4444", undefined, "ws-1", "user-1"),
        Layer.mergeAll(database, events.layer, sync.layer),
      ),
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Failed to create or resolve label");
  });

  it("createLabel publishes task.label_created only for a fresh task-level insert", async () => {
    const inserted = { ...TASK_LABEL };
    const database = makeTestDatabase({
      select: selectReturning([TASK]),
      insert: insertReturning([inserted]),
    });
    const events = makeTestEvents();
    const sync = makeTestLabelSync();

    const result = await Effect.runPromise(
      Effect.provide(
        createLabel("bug", "EF4444", "task-1", "ws-1", "user-1"),
        Layer.mergeAll(database, events.layer, sync.layer),
      ),
    );

    expect(result).toEqual(inserted);
    expect(sync.calls).toEqual([
      { method: "syncToGitHub", args: ["task-1", "bug", "EF4444"] },
      { method: "syncToGitea", args: ["task-1", "bug", "EF4444"] },
    ]);
    expect(events.published).toEqual([
      {
        type: "task.label_created",
        data: {
          projectId: "proj-1",
          taskId: "task-1",
          userId: "user-1",
          type: "label_created",
        },
      },
    ]);
  });
});
