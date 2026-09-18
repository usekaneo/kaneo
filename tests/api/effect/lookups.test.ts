import { drizzle } from "drizzle-orm/node-postgres";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { DrizzleClient } from "../../../apps/api/src/database/client";
import { findLabel, findTaskRef } from "../../../apps/api/src/database/lookups";
import {
  labelTable,
  projectTable,
  taskTable,
} from "../../../apps/api/src/database/schema";
import { DatabaseError } from "../../../apps/api/src/effect/database";
import { NotFound } from "../../../apps/api/src/effect/errors";
import { labelById, taskRefById } from "../../../apps/api/src/effect/lookups";
import { makeTestDatabase } from "../../../apps/api/src/effect/testing";

const TASK = { id: "task-1", projectId: "proj-1", workspaceId: "ws-1" };

const LABEL = {
  id: "label-1",
  name: "bug",
  color: "EF4444",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: null,
  workspaceId: "ws-1",
};

const compileClient = drizzle.mock({
  schema: { labelTable, projectTable, taskTable },
}) as unknown as DrizzleClient;

function failureOf(effect: Effect.Effect<unknown, unknown>) {
  return Effect.runPromise(effect).then(
    () => {
      throw new Error("expected the effect to fail");
    },
    (error: unknown) => error,
  );
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

describe("database lookups", () => {
  it("findTaskRef joins the project to carry the workspace id", () => {
    const { sql, params } = findTaskRef("task-1", compileClient).toSQL();

    expect(sql).toContain('inner join "project"');
    expect(sql).toContain('"task"."project_id" = "project"."id"');
    expect(sql).toContain('"project"."workspace_id"');
    expect(sql).toContain('"task"."id" = $1');
    expect(params).toEqual(["task-1", 1]);
  });

  it("findLabel selects by id", () => {
    const { sql, params } = findLabel("label-1", compileClient).toSQL();

    expect(sql).toContain('from "label" "labelTable"');
    expect(sql).toContain('"labelTable"."id" = $1');
    expect(params).toEqual(["label-1", 1]);
  });
});

describe("Effect lookups", () => {
  it("taskRefById returns the joined row", async () => {
    const database = makeTestDatabase({ select: selectReturning([TASK]) });

    await expect(
      Effect.runPromise(Effect.provide(taskRefById("task-1"), database)),
    ).resolves.toEqual(TASK);
  });

  it("taskRefById fails with NotFound for a missing task", async () => {
    const database = makeTestDatabase({ select: selectReturning([]) });

    const error = await failureOf(
      Effect.provide(taskRefById("missing"), database),
    );

    expect(error).toBeInstanceOf(NotFound);
    expect(error).toMatchObject({ entity: "Task", id: "missing" });
  });

  it("labelById uses the transaction executor when one is passed", async () => {
    const serviceClient = makeTestDatabase({
      query: {
        labelTable: {
          findFirst: () => Promise.reject(new Error("service client used")),
        },
      },
    });
    const tx = {
      query: <A>(run: (client: DrizzleClient) => PromiseLike<A>) =>
        Effect.tryPromise({
          try: () =>
            run({
              query: {
                labelTable: { findFirst: () => Promise.resolve(LABEL) },
              },
            } as unknown as DrizzleClient),
          catch: (cause) => new DatabaseError({ cause }),
        }),
    };

    await expect(
      Effect.runPromise(
        Effect.provide(labelById("label-1", tx), serviceClient),
      ),
    ).resolves.toEqual(LABEL);
  });
});
