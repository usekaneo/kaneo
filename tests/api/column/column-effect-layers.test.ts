import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import createColumn from "../../../apps/api/src/column/controllers/create-column";
import deleteColumn from "../../../apps/api/src/column/controllers/delete-column";
import reorderColumns from "../../../apps/api/src/column/controllers/reorder-columns";
import {
  ColumnHasTasks,
  ColumnNotInProject,
  DuplicateColumnSlug,
  InvalidColumnName,
  ReservedColumnSlug,
} from "../../../apps/api/src/column/errors";
import { NotFound } from "../../../apps/api/src/effect/errors";
import { makeTestDatabase } from "../../../apps/api/src/effect/testing";

const COLUMN = {
  id: "col-1",
  projectId: "proj-1",
  name: "Done",
  slug: "done",
  position: 2,
  icon: null,
  color: null,
  isFinal: true,
  createdAt: new Date("2026-09-18T10:00:00.000Z"),
  updatedAt: new Date("2026-09-18T10:00:00.000Z"),
};

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
    where: () => Promise.resolve(queue.shift() ?? []),
  };
  return () => chain;
}

describe("column controllers through the Effect test layers", () => {
  it("createColumn rejects a name without alphanumeric characters", async () => {
    const error = await failureOf(
      Effect.provide(
        createColumn({ projectId: "proj-1", name: "!!!" }),
        makeTestDatabase({}),
      ),
    );

    expect(error).toBeInstanceOf(InvalidColumnName);
  });

  it("createColumn rejects a reserved virtual status slug", async () => {
    const error = await failureOf(
      Effect.provide(
        createColumn({ projectId: "proj-1", name: "Archived" }),
        makeTestDatabase({}),
      ),
    );

    expect(error).toBeInstanceOf(ReservedColumnSlug);
    expect(error).toMatchObject({ slug: "archived" });
  });

  it("createColumn rejects a duplicate slug in the project", async () => {
    const database = makeTestDatabase({
      select: selectSequence([[{ id: "col-0" }]]),
    });

    const error = await failureOf(
      Effect.provide(
        createColumn({ projectId: "proj-1", name: "Done" }),
        database,
      ),
    );

    expect(error).toBeInstanceOf(DuplicateColumnSlug);
    expect(error).toMatchObject({ projectId: "proj-1", slug: "done" });
  });

  it("createColumn appends after the highest position", async () => {
    let inserted: Record<string, unknown> | undefined;
    const database = makeTestDatabase({
      select: selectSequence([[], [{ maxPosition: 4 }]]),
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          inserted = values;
          return {
            returning: () => Promise.resolve([{ ...COLUMN, ...values }]),
          };
        },
      }),
    });

    const result = await Effect.runPromise(
      Effect.provide(
        createColumn({ projectId: "proj-1", name: "Done", isFinal: true }),
        database,
      ),
    );

    expect(inserted).toMatchObject({
      slug: "done",
      position: 5,
      isFinal: true,
    });
    expect(result.position).toBe(5);
  });

  it("deleteColumn fails with NotFound for an unknown column", async () => {
    const database = makeTestDatabase({
      query: { columnTable: { findFirst: () => Promise.resolve(undefined) } },
    });

    const error = await failureOf(
      Effect.provide(deleteColumn("missing"), database),
    );

    expect(error).toBeInstanceOf(NotFound);
    expect(error).toMatchObject({ entity: "Column", id: "missing" });
  });

  it("deleteColumn refuses a column that still has tasks", async () => {
    let deleted = false;
    const database = makeTestDatabase({
      query: { columnTable: { findFirst: () => Promise.resolve(COLUMN) } },
      select: selectSequence([[{ count: 3 }]]),
      delete: () => {
        deleted = true;
        throw new Error("must not delete");
      },
    });

    const error = await failureOf(
      Effect.provide(deleteColumn("col-1"), database),
    );

    expect(error).toBeInstanceOf(ColumnHasTasks);
    expect(error).toMatchObject({ id: "col-1", count: 3 });
    expect(deleted).toBe(false);
  });

  it("reorderColumns rejects a column from another project", async () => {
    const database = makeTestDatabase({
      update: () => ({
        set: () => ({
          where: () => ({ returning: () => Promise.resolve([]) }),
        }),
      }),
    });

    const error = await failureOf(
      Effect.provide(
        reorderColumns("proj-1", [{ id: "col-9", position: 0 }]),
        database,
      ),
    );

    expect(error).toBeInstanceOf(ColumnNotInProject);
    expect(error).toMatchObject({ id: "col-9", projectId: "proj-1" });
  });
});
